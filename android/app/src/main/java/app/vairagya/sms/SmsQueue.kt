package app.vairagya.sms

import android.content.Context
import android.util.Log
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
 *
 * IMPORTANT: the queue is the single source of truth for live SMS delivery.
 * It is only cleared once the JS layer has *pulled* the entries
 * ([SmsInboxPlugin.getPendingSms]) — never on plugin load/resume, because at
 * that point no JS listener may exist yet and the message would be lost.
 */
object SmsQueue {
    private const val TAG = "VairagyaSms"
    private const val PREFS = "vairagya_sms_queue"
    private const val KEY = "pending"
    private const val MAX = 500

    @Synchronized
    fun push(context: Context, payload: JSObject) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val arr = read(prefs.getString(KEY, null))
        arr.put(payload.toString())
        while (arr.length() > MAX) arr.remove(0)
        // commit(), not apply(): the receiver's process can be killed by the OS
        // immediately after onReceive() returns, and apply() is asynchronous.
        prefs.edit().putString(KEY, arr.toString()).commit()
        Log.d(TAG, "SmsQueue.push -> persisted, queue size=${arr.length()}")
    }

    /** Reads the queue WITHOUT clearing it. */
    @Synchronized
    fun peek(context: Context): List<JSObject> {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY, null) ?: return emptyList()
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
        Log.d(TAG, "SmsQueue.peek -> ${out.size} pending")
        return out
    }

    @Synchronized
    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY).commit()
        Log.d(TAG, "SmsQueue.clear -> queue emptied")
    }

    /** Reads and clears in one step. */
    @Synchronized
    fun drain(context: Context): List<JSObject> {
        val out = peek(context)
        if (out.isNotEmpty()) clear(context)
        return out
    }

    private fun read(raw: String?): JSONArray =
        try {
            if (raw.isNullOrEmpty()) JSONArray() else JSONArray(raw)
        } catch (e: Exception) {
            JSONArray()
        }
}
