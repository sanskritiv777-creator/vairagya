package app.vairagya.notifications

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.getcapacitor.JSObject

class VairagyaNotificationService : NotificationListenerService() {

    companion object {
        private const val TAG = "VairagyaNotif"
    }

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


    private val AMOUNT_RE = Regex(
        "(?:\\u20B9|Rs\\.?|INR)\\s?[0-9][0-9,]*(?:\\.[0-9]{1,2})?|[0-9][0-9,]*(?:\\.[0-9]{1,2})?\\s?(?:INR|rupees)",
        RegexOption.IGNORE_CASE
    )

    private val VERB_RE = Regex(
        "credited|credit|debited|debit|received|receive|paid|payment|sent|send|transferred|transfer|deposited|withdrawn|spent|refund|upi|txn|transaction",
        RegexOption.IGNORE_CASE
    )

    private val NOISE_RE = Regex(
        "otp|one[ -]?time password|do not share|cashback offer|reward|scratch card|invite|referral|complete your kyc|reminder to pay|due on|bill is due|autopay set|request(?:ed)? (?:money|payment) from you|collect request",
        RegexOption.IGNORE_CASE
    )

    override fun onListenerConnected() {
        super.onListenerConnected()

        Log.d(TAG, "LISTENER_CONNECTED")

        try {
            val active = getActiveNotifications()

            Log.d(
                TAG,
                "ACTIVE_NOTIFICATIONS=${active.size}"
            )

            active.forEach { sbn ->
                processNotification(sbn, "active")
            }

        } catch (e: Exception) {
            Log.e(
                TAG,
                "FAILED_TO_READ_ACTIVE_NOTIFICATIONS",
                e
            )
        }
    }

    override fun onNotificationPosted(
        sbn: StatusBarNotification?
    ) {
        if (sbn == null) {
            Log.w(TAG, "NULL_NOTIFICATION")
            return
        }

        Log.d(
            TAG,
            "NOTIFICATION_POSTED package=${sbn.packageName}"
        )

        processNotification(sbn, "posted")
    }

    private fun processNotification(
        sbn: StatusBarNotification,
        sourceEvent: String
    ) {

        val pkg = sbn.packageName ?: return

        Log.d(
            TAG,
            "CHECKING_PACKAGE=$pkg"
        )

        val interesting =
            watched.contains(pkg) ||
            pkg.contains("bank", ignoreCase = true) ||
            pkg.contains("upi", ignoreCase = true) ||
            pkg.contains("pay", ignoreCase = true)

        if (!interesting) {
            Log.d(
                TAG,
                "IGNORED_PACKAGE=$pkg"
            )
            return
        }

        val notification = sbn.notification ?: return
        val extras = notification.extras ?: return

        val title =
            extras.getCharSequence(
                Notification.EXTRA_TITLE
            )?.toString()?.trim() ?: ""

        val text =
            extras.getCharSequence(
                Notification.EXTRA_TEXT
            )?.toString()?.trim() ?: ""

        val bigText =
            extras.getCharSequence(
                Notification.EXTRA_BIG_TEXT
            )?.toString()?.trim() ?: ""

        val subText =
            extras.getCharSequence(
                Notification.EXTRA_SUB_TEXT
            )?.toString()?.trim() ?: ""

        val infoText =
            extras.getCharSequence(
                Notification.EXTRA_INFO_TEXT
            )?.toString()?.trim() ?: ""

        val summaryText =
            extras.getCharSequence(
                Notification.EXTRA_SUMMARY_TEXT
            )?.toString()?.trim() ?: ""

        val lines =
            extras.getCharSequenceArray(
                Notification.EXTRA_TEXT_LINES
            )
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

        if (finalText.isBlank()) {
            Log.d(
                TAG,
                "EMPTY_NOTIFICATION package=$pkg"
            )
            return
        }

        // Only forward notifications that actually look financial: they must
        // mention an amount AND a money-movement word. This keeps chat
        // notifications from WhatsApp (and app promos) out of the parser while
        // imposing NO minimum amount — ₹1 qualifies exactly like ₹3000.
        if (!looksFinancial(finalText)) {
            Log.d(
                TAG,
                "NOT_FINANCIAL package=$pkg text=${finalText.take(120)}"
            )
            return
        }


        Log.d(
            TAG,
            "CAPTURED event=$sourceEvent package=$pkg text=${finalText.take(500)}"
        )

        val payload = JSObject()

        payload.put(
            "package",
            pkg
        )

        payload.put(
            "title",
            title
        )

        payload.put(
            "text",
            finalText
        )

        payload.put(
            "time",
            sbn.postTime
        )

        Log.d(
            TAG,
            "EMITTING_TO_BRIDGE package=$pkg"
        )

        NotificationListenerPlugin.emit(payload)
    }

    /**
     * Amount + money-movement keyword gate. No minimum amount is applied.
     */
    private fun looksFinancial(text: String): Boolean {

        val hasAmount = AMOUNT_RE.containsMatchIn(text)
        val hasVerb = VERB_RE.containsMatchIn(text)
        val isNoise = NOISE_RE.containsMatchIn(text)

        return hasAmount && hasVerb && !isNoise
    }
}
