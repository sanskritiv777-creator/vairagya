package app.vairagya.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import com.getcapacitor.JSObject

/**
 * Manifest-declared receiver for incoming SMS.
 *
 * Delivery contract: PERSIST FIRST, notify second. The receiver frequently runs
 * in a process that has no WebView/Capacitor bridge (app closed), so the
 * persisted [SmsQueue] — not the in-memory plugin instance — is the source of
 * truth. JS pulls the queue on attach and on every resume.
 */
class SmsReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "VairagyaSms"
    }

    override fun onReceive(context: Context?, intent: Intent?) {
        Log.d(TAG, "SmsReceiver.onReceive action=${intent?.action}")
        if (intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val messages = try {
            Telephony.Sms.Intents.getMessagesFromIntent(intent)
        } catch (e: Exception) {
            Log.e(TAG, "getMessagesFromIntent failed: ${e.message}")
            null
        } ?: return
        Log.d(TAG, "SmsReceiver: ${messages.size} PDU part(s)")

        // Multipart SMS arrive as several parts of ONE logical message: parts are
        // already in order, so concatenate bodies and keep the FIRST timestamp.
        val bodies = StringBuilder()
        var address = ""
        var timestamp = 0L
        for (msg in messages) {
            if (msg == null) continue
            bodies.append(msg.displayMessageBody ?: msg.messageBody ?: "")
            if (address.isEmpty()) {
                address = msg.originatingAddress ?: msg.displayOriginatingAddress ?: ""
            }
            if (timestamp == 0L && msg.timestampMillis > 0L) timestamp = msg.timestampMillis
        }
        if (timestamp == 0L) timestamp = System.currentTimeMillis()
        val body = bodies.toString()
        if (body.isEmpty()) {
            Log.w(TAG, "SmsReceiver: empty body, ignoring")
            return
        }

        val payload = JSObject()
        payload.put("address", address)
        payload.put("body", body)
        payload.put("date", timestamp)

        // 1) Persist synchronously — survives this process being killed.
        val ctx = context
        if (ctx != null) {
            try {
                SmsQueue.push(ctx, payload)
            } catch (e: Exception) {
                Log.e(TAG, "SmsQueue.push failed: ${e.message}")
            }
        }
        // 2) Best-effort live delivery if a bridge happens to be alive.
        SmsInboxPlugin.emit(payload)
        Log.d(TAG, "SmsReceiver: handled SMS from $address (${body.length} chars)")
    }
}
