package app.vairagya.notifications

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.getcapacitor.JSObject

class VairagyaNotificationService : NotificationListenerService() {

    private val watched = setOf(
        "com.phonepe.app",
        "com.google.android.apps.nbu.paisa.user",
        "net.one97.paytm",
        "in.org.npci.upiapp",
        "com.dreamplug.androidapp",
        "com.mobikwik_new",
        "com.amazon.mShop.android.shopping",
        "com.whatsapp",
        "com.sbi.lotusintouch",
        "com.sbi.SBIFreedomPlus",
        "com.snapwork.hdfc",
        "com.csam.icici.bank.imobile",
        "com.axis.mobile",
        "com.msf.kbank.mobile",
        "com.fss.idfcpsp",
        "com.bankofbaroda.mconnect",
        "com.canarabank.mobility",
        "com.infrasoft.uboi",
        "com.fss.pnbpsp",
        "com.bandhanbank.mobile",
        "com.fedmobile"
    )

    override fun onListenerConnected() {
        super.onListenerConnected()

        Log.d("VairagyaNotif", "NOTIFICATION LISTENER CONNECTED")

        try {
            val active = getActiveNotifications()
            Log.d("VairagyaNotif", "Active notifications: ${active.size}")

            for (sbn in active) {
                processNotification(sbn)
            }
        } catch (e: Exception) {
            Log.e("VairagyaNotif", "Failed reading active notifications", e)
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return

        Log.d(
            "VairagyaNotif",
            "NEW NOTIFICATION from package: ${sbn.packageName}"
        )

        processNotification(sbn)
    }

    private fun processNotification(sbn: StatusBarNotification) {
        val pkg = sbn.packageName ?: return

        val interesting =
            watched.contains(pkg) ||
            pkg.contains("bank", true) ||
            pkg.contains("upi", true) ||
            pkg.contains("pay", true)

        if (!interesting) {
            Log.d("VairagyaNotif", "Ignored package: $pkg")
            return
        }

        val notification = sbn.notification ?: return
        val extras = notification.extras ?: return

        val title =
            extras.getCharSequence(Notification.EXTRA_TITLE)
                ?.toString()
                ?.trim()
                ?: ""

        val text =
            extras.getCharSequence(Notification.EXTRA_TEXT)
                ?.toString()
                ?.trim()
                ?: ""

        val bigText =
            extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
                ?.toString()
                ?.trim()
                ?: ""

        val subText =
            extras.getCharSequence(Notification.EXTRA_SUB_TEXT)
                ?.toString()
                ?.trim()
                ?: ""

        val infoText =
            extras.getCharSequence(Notification.EXTRA_INFO_TEXT)
                ?.toString()
                ?.trim()
                ?: ""

        val summaryText =
            extras.getCharSequence(Notification.EXTRA_SUMMARY_TEXT)
                ?.toString()
                ?.trim()
                ?: ""

        val lines =
            extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)
                ?.map { it.toString().trim() }
                ?.filter { it.isNotBlank() }
                ?.joinToString(" ")
                ?: ""

        val finalText = listOf(
            title,
            text,
            bigText,
            subText,
            infoText,
            summaryText,
            lines
        )
            .filter { it.isNotBlank() }
            .distinct()
            .joinToString(" — ")

        Log.d(
            "VairagyaNotif",
            "CAPTURED: package=$pkg title=$title text=$finalText"
        )

        if (finalText.isBlank()) return

        val payload = JSObject().apply {
            put("package", pkg)
            put("title", title)
            put("text", finalText)
            put("time", sbn.postTime)
        }

        NotificationListenerPlugin.emit(payload)
    }
}
        // Also inspect notifications that are currently active.
        val active = getActiveNotifications()
        Log.d("VairagyaNotif", "Active notifications: ${active.size}")

        for (sbn in active) {
            processNotification(sbn)
        }
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return

        Log.d(
            "VairagyaNotif",
            "NEW NOTIFICATION from package: ${sbn.packageName}"
        )

        processNotification(sbn)
    }

    private fun processNotification(sbn: StatusBarNotification) {
        val pkg = sbn.packageName ?: return

        Log.d("VairagyaNotif", "Checking package: $pkg")

        val interesting =
            watched.contains(pkg) ||
            pkg.contains("bank", true) ||
            pkg.contains("upi", true) ||
            pkg.contains("pay", true)

        if (!interesting) {
            Log.d("VairagyaNotif", "Ignored package: $pkg")
            return
        }

        val notification = sbn.notification ?: return
        val extras = notification.extras ?: return

        val title =
            extras.getCharSequence("android.title")?.toString() ?: ""

        val text =
            extras.getCharSequence("android.text")?.toString()
                ?: extras.getCharSequence("android.bigText")?.toString()
                ?: ""

        val lines =
            extras.getCharSequenceArray("android.textLines")
                ?.joinToString(" ") { it.toString() }
                ?: ""

        val finalText = listOf(title, text, lines)
            .filter { it.isNotBlank() }
            .distinct()
            .joinToString(" — ")

        Log.d(
            "VairagyaNotif",
            "CAPTURED: package=$pkg text=$finalText"
        )

        if (finalText.isBlank()) return

        val payload = JSObject()
        payload.put("package", pkg)
        payload.put("title", title)
        payload.put("text", finalText)
        payload.put("time", sbn.postTime)

        NotificationListenerPlugin.emit(payload)
    }
}
