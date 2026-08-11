package app.vairagya.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.telephony.SmsMessage
import android.util.Log
import com.getcapacitor.JSObject

class SmsReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "VairagyaSms"
    }

    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return

        val bundle: Bundle? = intent.extras
        try {
            val pdus = bundle?.get("pdus") as? Array<*> ?: return
            for (pdu in pdus) {
                val format = bundle.getString("format")
                val sms = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                    SmsMessage.createFromPdu(pdu as ByteArray, format)
                } else {
                    SmsMessage.createFromPdu(pdu as ByteArray)
                }

                val payload = JSObject()
                payload.put("address", sms.originatingAddress ?: "")
                payload.put("body", sms.messageBody ?: "")
                payload.put("date", sms.timestampMillis)

                Log.d(TAG, "SmsReceiver -> captured sms from=${sms.originatingAddress}")

                // Persist to disk-backed queue for the JS layer to pull
                SmsQueue.push(context, payload)

                // Attempt live emit to any existing plugin instance
                SmsInboxPlugin.emit(payload)
            }
        } catch (e: Exception) {
            Log.e(TAG, "SmsReceiver failed: ${e.message}")
        }
    }
}
