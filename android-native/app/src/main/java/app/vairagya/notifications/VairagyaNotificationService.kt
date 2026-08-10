package app.vairagya.notifications

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
