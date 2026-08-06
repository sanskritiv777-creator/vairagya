package app.vairagya.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import com.getcapacitor.JSObject

/**
 * Manifest-declared receiver for incoming SMS. Forwards each message to
 * [SmsInboxPlugin], which delivers it to JS immediately or buffers it until
 * the web layer attaches (e.g. when the process was started by this very
 * broadcast).
 */
class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val messages = try {
            Telephony.Sms.Intents.getMessagesFromIntent(intent)
        } catch (e: Exception) {
            null
        } ?: return

        // Multipart SMS arrive as several parts of one logical message.
        val bodies = StringBuilder()
        var address = ""
        var timestamp = System.currentTimeMillis()
        for (msg in messages) {
            if (msg == null) continue
            bodies.append(msg.displayMessageBody ?: msg.messageBody ?: "")
            if (address.isEmpty()) {
                address = msg.originatingAddress ?: msg.displayOriginatingAddress ?: ""
            }
            timestamp = msg.timestampMillis
        }
        val body = bodies.toString()
        if (body.isEmpty()) return

        val payload = JSObject()
        payload.put("address", address)
        payload.put("body", body)
        payload.put("date", timestamp)
        SmsInboxPlugin.emit(payload)
    }
}
