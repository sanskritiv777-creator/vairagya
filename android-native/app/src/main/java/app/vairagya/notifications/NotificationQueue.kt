package app.vairagya.notifications

import android.content.Context
import android.util.Log
import com.getcapacitor.JSObject
import org.json.JSONArray

/**
 * Persistent notification queue.
 *
 * Notifications can arrive while the Vairagya app is completely closed.
 * This stores them on disk so the JavaScript layer can retrieve them
 * the next time the app opens.
 */
object NotificationQueue {

    private const val TAG = "VairagyaNotif"
    private const val PREFS = "vairagya_notification_queue"
    private const val KEY = "pending"
    private const val MAX = 500

    @Synchronized
    fun push(
        context: Context,
        payload: JSObject
    ) {
        val prefs = context.getSharedPreferences(
            PREFS,
            Context.MODE_PRIVATE
        )

        val arr = read(
            prefs.getString(KEY, null)
        )

        arr.put(payload.toString())

        while (arr.length() > MAX) {
            arr.remove(0)
        }

        // commit() is intentional because Android may kill the
        // notification-listener process immediately after delivery.
        prefs.edit()
            .putString(KEY, arr.toString())
            .commit()

        Log.d(
            TAG,
            "NotificationQueue.push size=${arr.length()}"
        )
    }

    @Synchronized
    fun peek(
        context: Context
    ): List<JSObject> {

        val prefs = context.getSharedPreferences(
            PREFS,
            Context.MODE_PRIVATE
        )

        val raw = prefs.getString(
            KEY,
            null
        ) ?: return emptyList()

        val arr = read(raw)

        val result = ArrayList<JSObject>()

        for (i in 0 until arr.length()) {

            val item = arr.optString(i)

            if (item.isBlank()) {
                continue
            }

            try {
                result.add(
                    JSObject(item)
                )
            } catch (_: Exception) {
                // Ignore malformed entries.
            }
        }

        return result
    }

    @Synchronized
    fun clear(
        context: Context
    ) {

        context.getSharedPreferences(
            PREFS,
            Context.MODE_PRIVATE
        )
            .edit()
            .remove(KEY)
            .commit()

        Log.d(
            TAG,
            "NotificationQueue.clear"
        )
    }

    @Synchronized
    fun drain(
        context: Context
    ): List<JSObject> {

        val result = peek(context)

        if (result.isNotEmpty()) {
            clear(context)
        }

        return result
    }

    private fun read(
        raw: String?
    ): JSONArray {

        return try {

            if (raw.isNullOrEmpty()) {
                JSONArray()
            } else {
                JSONArray(raw)
            }

        } catch (_: Exception) {

            JSONArray()
        }
    }
}
