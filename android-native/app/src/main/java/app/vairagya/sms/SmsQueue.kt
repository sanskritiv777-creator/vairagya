package app.vairagya.sms

import android.content.Context
import com.getcapacitor.JSObject
import org.json.JSONArray

/**
 * Disk-backed queue for SMS that arrived while no JS layer was attached.
 *
 * The in-memory buffer inside [SmsInboxPlugin] only survives inside a single
 * process. When the app is fully closed, Android starts a *fresh* process just
 * to run [SmsReceiver]; that process is torn down again seconds later, so an
 * in-memory hand-off is always lost. Persisting here means the very next app
 * launch (or resume) still delivers the message to JS.
 */
object SmsQueue {
    private const val PREFS = "vairagya_sms_queue"
    private const val KEY = "pending"
    private const val MAX = 200

    @Synchronized
    fun push(context: Context, payload: JSObject) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val arr = read(prefs.getString(KEY, null))
        arr.put(payload.toString())
        while (arr.length() > MAX) arr.remove(0)
        prefs.edit().putString(KEY, arr.toString()).apply()
    }

    @Synchronized
    fun drain(context: Context): List<JSObject> {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY, null) ?: return emptyList()
        prefs.edit().remove(KEY).apply()
        val arr = read(raw)
        val out = ArrayList<JSObject>()
        for (i in 0 until arr.length()) {
            val item = arr.optString(i) ?: continue
            try {
                out.add(JSObject(item))
            } catch (e: Exception) {
                /* skip malformed entry */
            }
        }
        return out
    }

    private fun read(raw: String?): JSONArray =
        try {
            if (raw.isNullOrEmpty()) JSONArray() else JSONArray(raw)
        } catch (e: Exception) {
            JSONArray()
        }
}
