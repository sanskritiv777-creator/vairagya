#!/usr/bin/env python3
"""Idempotently prepare the generated Android project for Vairagya:

1. Inject required <uses-permission> entries.
2. Register the SMS <queries> block for Android 11+ package visibility.
3. Copy the native Kotlin sources from android-native/ into the app module.
4. Register the NotificationListener plugin in MainActivity.
5. Declare the NotificationListenerService in the manifest.

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


def register_plugin() -> None:
    candidates = list((ANDROID / "app/src/main/java").rglob("MainActivity.*"))
    if not candidates:
        print("[patch-manifest] MainActivity not found; skipping plugin registration")
        return
    for main in candidates:
        text = main.read_text()
        if "NotificationListenerPlugin" in text:
            print(f"[patch-manifest] plugin already registered in {main.name}")
            continue
        if main.suffix == ".java":
            new_text, n = re.subn(
                r"(public class MainActivity extends BridgeActivity \{)",
                r"""\1
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(app.vairagya.notifications.NotificationListenerPlugin.class);
        super.onCreate(savedInstanceState);
    }
""",
                text,
                count=1,
            )
        else:
            new_text, n = re.subn(
                r"(class MainActivity\s*:\s*BridgeActivity\(\)\s*\{)",
                r"""\1
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        registerPlugin(app.vairagya.notifications.NotificationListenerPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
""",
                text,
                count=1,
            )
            if n == 0:
                # Bare `class MainActivity : BridgeActivity()` with no body.
                new_text, n = re.subn(
                    r"(class MainActivity\s*:\s*BridgeActivity\(\))\s*$",
                    r"""\1 {
    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        registerPlugin(app.vairagya.notifications.NotificationListenerPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}""",
                    text,
                    count=1,
                    flags=re.MULTILINE,
                )
        if n:
            main.write_text(new_text)
            print(f"[patch-manifest] registered plugin in {main.name}")
        else:
            print(f"[patch-manifest] could not patch {main.name}; left unchanged")


def main() -> int:
    if not MANIFEST.exists():
        print(f"[patch-manifest] {MANIFEST} not found; skipping.")
        return 0
    patch_manifest()
    copy_native_sources()
    register_plugin()
    return 0


if __name__ == "__main__":
    sys.exit(main())
