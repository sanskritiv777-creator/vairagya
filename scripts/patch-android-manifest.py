#!/usr/bin/env python3
"""Idempotently prepare the generated Android project for Vairagya:

1. Inject required <uses-permission> entries.
2. Register the SMS <queries> block for Android 11+ package visibility.
3. Copy the native Kotlin sources from android-native/ into the app module.
4. Register the native Capacitor plugins in MainActivity.
5. Declare the NotificationListenerService + SMS receiver in the manifest.
6. Enable the Kotlin Gradle plugin so the Kotlin sources compile.

Runs from CI after `bunx cap sync android`. Safe to run multiple times.
"""
from pathlib import Path
import re
import shutil
import sys

ANDROID = Path("android")
MANIFEST = ANDROID / "app/src/main/AndroidManifest.xml"
NATIVE_SRC = Path("android-native/app/src/main/java")
NATIVE_DST = ANDROID / "app/src/main/java"

PLUGIN_CLASSES = [
    "app.vairagya.notifications.NotificationListenerPlugin",
    "app.vairagya.sms.SmsInboxPlugin",
]

REQUIRED_PERMISSIONS = [
    "android.permission.INTERNET",
    "android.permission.READ_SMS",
    "android.permission.RECEIVE_SMS",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.USE_BIOMETRIC",
    "android.permission.USE_FINGERPRINT",
    "android.permission.RECEIVE_BOOT_COMPLETED",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.WAKE_LOCK",
    "android.permission.VIBRATE",
]

QUERIES_BLOCK = """    <queries>
        <intent>
            <action android:name="android.intent.action.SENDTO" />
            <data android:scheme="smsto" />
        </intent>
        <intent>
            <action android:name="android.provider.Telephony.SMS_RECEIVED" />
        </intent>
    </queries>
"""

NOTIF_SERVICE_BLOCK = """
        <service
            android:name="app.vairagya.notifications.VairagyaNotificationService"
            android:exported="false"
            android:label="Vairagya transaction import"
            android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE">
            <intent-filter>
                <action android:name="android.service.notification.NotificationListenerService" />
            </intent-filter>
        </service>
"""

SMS_RECEIVER_BLOCK = """
        <receiver
            android:name="app.vairagya.sms.SmsReceiver"
            android:exported="true"
            android:permission="android.permission.BROADCAST_SMS">
            <intent-filter android:priority="999">
                <action android:name="android.provider.Telephony.SMS_RECEIVED" />
            </intent-filter>
        </receiver>
"""


def patch_manifest() -> None:
    xml = MANIFEST.read_text()

    lines_to_add = [
        f'    <uses-permission android:name="{perm}" />'
        for perm in REQUIRED_PERMISSIONS
        if f'android:name="{perm}"' not in xml
    ]
    if lines_to_add:
        block = "\n".join(lines_to_add) + "\n"
        xml = re.sub(
            r"(\s*)(<application\b)",
            lambda m: "\n" + block + m.group(1) + m.group(2),
            xml,
            count=1,
        )

    if "<queries>" not in xml:
        xml = re.sub(
            r"(\s*)(<application\b)",
            lambda m: "\n" + QUERIES_BLOCK + m.group(1) + m.group(2),
            xml,
            count=1,
        )

    if "VairagyaNotificationService" not in xml:
        xml = xml.replace("</application>", NOTIF_SERVICE_BLOCK + "\n    </application>", 1)

    if "app.vairagya.sms.SmsReceiver" not in xml:
        xml = xml.replace("</application>", SMS_RECEIVER_BLOCK + "\n    </application>", 1)

    MANIFEST.write_text(xml)
    print(f"[patch-manifest] Updated {MANIFEST}")


def copy_native_sources() -> None:
    if not NATIVE_SRC.exists():
        print("[patch-manifest] no android-native sources; skipping copy")
        return
    for src in NATIVE_SRC.rglob("*.kt"):
        rel = src.relative_to(NATIVE_SRC)
        dst = NATIVE_DST / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
        print(f"[patch-manifest] copied {rel}")


def register_plugins() -> None:
    candidates = list((ANDROID / "app/src/main/java").rglob("MainActivity.*"))
    if not candidates:
        print("[patch-manifest] MainActivity not found; skipping plugin registration")
        return
    for main in candidates:
        text = main.read_text()
        if main.suffix == ".java":
            calls = "\n".join(
                f"        registerPlugin({cls}.class);" for cls in PLUGIN_CLASSES
            )
            body = (
                "\n    @Override\n"
                "    public void onCreate(android.os.Bundle savedInstanceState) {\n"
                f"{calls}\n"
                "        super.onCreate(savedInstanceState);\n"
                "    }\n"
            )
            if "registerPlugin(" in text:
                # Refresh an older single-plugin registration.
                text = re.sub(
                    r"\n\s*@Override\s*\n\s*public void onCreate\(android\.os\.Bundle savedInstanceState\) \{.*?\n    \}\n",
                    body,
                    text,
                    count=1,
                    flags=re.DOTALL,
                )
                main.write_text(text)
                print(f"[patch-manifest] refreshed registrations in {main.name}")
                continue
            new_text, n = re.subn(
                r"(public class MainActivity extends BridgeActivity \{)",
                lambda m: m.group(1) + body,
                text,
                count=1,
            )
        else:
            calls = "\n".join(
                f"        registerPlugin({cls}::class.java)" for cls in PLUGIN_CLASSES
            )
            body = (
                "\n    override fun onCreate(savedInstanceState: android.os.Bundle?) {\n"
                f"{calls}\n"
                "        super.onCreate(savedInstanceState)\n"
                "    }\n"
            )
            if "registerPlugin(" in text:
                text = re.sub(
                    r"\n\s*override fun onCreate\(savedInstanceState: android\.os\.Bundle\?\) \{.*?\n    \}\n",
                    body,
                    text,
                    count=1,
                    flags=re.DOTALL,
                )
                main.write_text(text)
                print(f"[patch-manifest] refreshed registrations in {main.name}")
                continue
            new_text, n = re.subn(
                r"(class MainActivity\s*:\s*BridgeActivity\(\)\s*\{)",
                lambda m: m.group(1) + body,
                text,
                count=1,
            )
            if n == 0:
                # Bare `class MainActivity : BridgeActivity()` with no body.
                new_text, n = re.subn(
                    r"(class MainActivity\s*:\s*BridgeActivity\(\))\s*$",
                    lambda m: m.group(1) + " {" + body + "}",
                    text,
                    count=1,
                    flags=re.MULTILINE,
                )
        if n:
            main.write_text(new_text)
            print(f"[patch-manifest] registered plugins in {main.name}")
        else:
            print(f"[patch-manifest] could not patch {main.name}; left unchanged")


def patch_build_gradle() -> None:
    build = ANDROID / "app/build.gradle"
    if not build.exists():
        print("[patch-manifest] build.gradle not found; skipping")
        return

    text = build.read_text()

    if "org.jetbrains.kotlin.android" not in text:
        text = text.replace(
            "apply plugin: 'com.android.application'",
            "apply plugin: 'com.android.application'\napply plugin: 'org.jetbrains.kotlin.android'",
        )
        print("[patch-manifest] enabled Kotlin Android plugin")

    if "androidx.core:core-ktx" not in text:
        text = re.sub(
            r"(dependencies \{)",
            r"\1\n    implementation 'androidx.core:core-ktx:1.13.1'",
            text,
            count=1,
        )
        print("[patch-manifest] added androidx.core:core-ktx dependency")

    build.write_text(text)


def patch_root_build_gradle() -> None:
    build = ANDROID / "build.gradle"
    if not build.exists():
        print("[patch-manifest] root build.gradle not found; skipping")
        return

    text = build.read_text()

    if "kotlin-gradle-plugin" not in text:
        text = re.sub(
            r"(classpath ['\"]com\.android\.tools\.build:gradle[^\n]*\n)",
            r"\1        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:2.1.21'\n",
            text,
            count=1,
        )
        if "kotlin-gradle-plugin" not in text:
            text = text.replace(
                "dependencies {",
                "dependencies {\n        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:2.1.21'",
                1,
            )
        print("[patch-manifest] added Kotlin Gradle plugin")

    build.write_text(text)


def main() -> int:
    if not MANIFEST.exists():
        print(f"[patch-manifest] {MANIFEST} not found; skipping.")
        return 0
    patch_manifest()
    copy_native_sources()
    patch_build_gradle()
    patch_root_build_gradle()
    register_plugins()
    return 0


if __name__ == "__main__":
    sys.exit(main())
