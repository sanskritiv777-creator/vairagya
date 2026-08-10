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

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        val notification = sbn ?: return
        val pkg = notification.packageName ?: return

        val interesting =
            watched.contains(pkg) ||
            pkg.contains("bank", true) ||
            pkg.contains("upi", true) ||
            pkg.contains("pay", true)

        if (!interesting) return

        val extras = notification.notification?.extras ?: return

        val title =
            extras.getCharSequence("android.title")?.toString() ?: ""

        val text =
            extras.getCharSequence("android.text")?.toString()
                ?: extras.getCharSequence("android.bigText")?.toString()
                ?: ""

        val lines =
            extras.getCharSequenceArray("android.textLines")
                ?.joinToString(" ")
                ?: ""

        val combinedText = listOf(title, text, lines)
            .filter { it.isNotBlank() }
            .distinct()
            .joinToString(" — ")

        if (combinedText.isBlank()) return

        Log.d(
            "VairagyaNotification",
            "RECEIVED: package=$pkg | text=$combinedText"
        )

        val payload = JSObject()
        payload.put("package", pkg)
        payload.put("title", title)
        payload.put("text", combinedText)
        payload.put("time", notification.postTime)

        NotificationListenerPlugin.emit(payload)
    }
}
