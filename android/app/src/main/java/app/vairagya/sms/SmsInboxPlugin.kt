package app.vairagya.sms

import android.Manifest
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.provider.Telephony
import android.util.Log
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * Native SMS inbox reader + live SMS bridge for Vairagya.
 *
 * Replaces `capacitor-sms-inbox`, which registered itself under the plugin
 * name `SMSInboxReader` (so `SmsInbox` was always undefined in JS, making the
 * app believe permission was denied), exposed no live `smsReceived` event and
 * ships an unmaintained Gradle module.
 *
 * JS side: src/native/sms.ts
 */
@CapacitorPlugin(
    name = "SmsInbox",
    permissions = [
        Permission(
            alias = SmsInboxPlugin.ALIAS_SMS,
            strings = [Manifest.permission.READ_SMS, Manifest.permission.RECEIVE_SMS]
        )
    ]
)
class SmsInboxPlugin : Plugin() {

    companion object {
        const val ALIAS_SMS = "sms"
        private const val TAG = "VairagyaSms"

        @Volatile
        private var instance: SmsInboxPlugin? = null

        /** Called from [SmsReceiver] for every incoming SMS. */
        fun emit(payload: JSObject) {
            val plugin = instance
            if (plugin != null) {
                Log.d(TAG, "emit -> notifyListeners(smsReceived) live")
                plugin.notifyListeners("smsReceived", payload, true)
            } else {
                // No bridge in this process: the persisted SmsQueue is the
                // source of truth and JS drains it via getPendingSms().
                Log.d(TAG, "emit -> no plugin instance, left in SmsQueue")
            }
        }
    }

    override fun load() {
        instance = this
        Log.d(TAG, "plugin loaded")
    }

    override fun handleOnResume() {
        // Deliberately NOT draining here: a drain before the JS listener is
        // attached would discard the message permanently. JS pulls instead.
        Log.d(TAG, "handleOnResume")
    }

    override fun handleOnDestroy() {
        if (instance === this) instance = null
    }


    private fun readGranted(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) ==
            PackageManager.PERMISSION_GRANTED

    private fun receiveGranted(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.RECEIVE_SMS) ==
            PackageManager.PERMISSION_GRANTED

    private fun statusObject(): JSObject {
        val res = JSObject()
        val granted = readGranted()
        // Capacitor's own permission map is cached per session; always report
        // the live OS state so returning from Settings is picked up instantly.
        res.put("sms", if (granted) "granted" else "prompt")
        res.put("read", readGranted())
        res.put("receive", receiveGranted())
        res.put("granted", granted)
        return res
    }

    @PluginMethod
    override fun checkPermissions(call: PluginCall) {
        call.resolve(statusObject())
    }

    @PluginMethod
    override fun requestPermissions(call: PluginCall) {
        if (readGranted() && receiveGranted()) {
            call.resolve(statusObject())
            return
        }
        requestPermissionForAlias(ALIAS_SMS, call, "smsPermissionCallback")
    }

    @PermissionCallback
    private fun smsPermissionCallback(call: PluginCall) {
        call.resolve(statusObject())
    }

    /**
     * Reads the SMS inbox. `minDate` (epoch ms, 0 = everything) and
     * `maxCount` bound the query; newest messages come first.
     */
    @PluginMethod
    fun getSmsList(call: PluginCall) {
        if (!readGranted()) {
            call.reject("READ_SMS permission not granted")
            return
        }
        val filter = call.getObject("filter") ?: JSObject()
        val minDate = filter.optLong("minDate", 0L)
        val maxCount = filter.optInt("maxCount", 20000)

        val list = JSArray()
        var cursor: Cursor? = null
        try {
            val uri: Uri = Telephony.Sms.Inbox.CONTENT_URI
            val projection = arrayOf(
                Telephony.Sms._ID,
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE
            )
            val selection = if (minDate > 0) "${Telephony.Sms.DATE} >= ?" else null
            val args = if (minDate > 0) arrayOf(minDate.toString()) else null
            cursor = context.contentResolver.query(
                uri,
                projection,
                selection,
                args,
                "${Telephony.Sms.DATE} DESC"
            )
            if (cursor != null) {
                val idIdx = cursor.getColumnIndex(Telephony.Sms._ID)
                val addrIdx = cursor.getColumnIndex(Telephony.Sms.ADDRESS)
                val bodyIdx = cursor.getColumnIndex(Telephony.Sms.BODY)
                val dateIdx = cursor.getColumnIndex(Telephony.Sms.DATE)
                var count = 0
                while (cursor.moveToNext() && count < maxCount) {
                    val item = JSObject()
                    if (idIdx >= 0) item.put("id", cursor.getLong(idIdx))
                    item.put("address", if (addrIdx >= 0) cursor.getString(addrIdx) ?: "" else "")
                    item.put("body", if (bodyIdx >= 0) cursor.getString(bodyIdx) ?: "" else "")
                    item.put("date", if (dateIdx >= 0) cursor.getLong(dateIdx) else 0L)
                    list.put(item)
                    count++
                }
            }
        } catch (e: Exception) {
            call.reject("Failed to read SMS inbox: ${e.message}", e)
            return
        } finally {
            cursor?.close()
        }

        val res = JSObject()
        res.put("smsList", list)
        call.resolve(res)
    }

    /** JS calls this to confirm the bridge is alive. */
    @PluginMethod
    fun startWatch(call: PluginCall) {
        val res = JSObject()
        res.put("watching", receiveGranted())
        Log.d(TAG, "startWatch -> watching=${receiveGranted()}")
        call.resolve(res)
    }

    /**
     * Pulls (and clears) every SMS persisted by [SmsReceiver] while the JS
     * layer was unavailable. This — not the in-memory instance — is the
     * reliable live-SMS delivery path.
     */
    @PluginMethod
    fun getPendingSms(call: PluginCall) {
        val list = JSArray()
        try {
            SmsQueue.drain(context).forEach { list.put(it) }
        } catch (e: Exception) {
            Log.e(TAG, "getPendingSms failed: ${e.message}")
        }
        Log.d(TAG, "getPendingSms -> ${list.length()} message(s)")
        val res = JSObject()
        res.put("messages", list)
        call.resolve(res)
    }
}
