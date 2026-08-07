package app.vairagya.sms

import android.Manifest
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.provider.Telephony
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

        @Volatile
        private var instance: SmsInboxPlugin? = null

        /** Messages received while the JS layer was not yet attached. */
        private val pending = ArrayList<JSObject>()

        /** Called from [SmsReceiver] for every incoming SMS. */
        fun emit(payload: JSObject) {
            val plugin = instance
            if (plugin != null) {
                plugin.notifyListeners("smsReceived", payload, true)
            } else {
                synchronized(pending) {
                    if (pending.size > 200) pending.removeAt(0)
                    pending.add(payload)
                }
            }
        }

        private fun drain(plugin: SmsInboxPlugin) {
            val queued: List<JSObject>
            synchronized(pending) {
                queued = ArrayList(pending)
                pending.clear()
            }
            // Messages persisted by SmsReceiver while no process/JS was alive.
            val persisted = try {
                SmsQueue.drain(plugin.context)
            } catch (e: Exception) {
                emptyList()
            }
            (queued + persisted).forEach { plugin.notifyListeners("smsReceived", it, true) }
        }
    }

    override fun load() {
        instance = this
        drain(this)
    }

    override fun handleOnResume() {
        drain(this)
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

    /** JS calls this to confirm the bridge is alive and flush buffered SMS. */
    @PluginMethod
    fun startWatch(call: PluginCall) {
        drain(this)
        val res = JSObject()
        res.put("watching", receiveGranted())
        call.resolve(res)
    }
}
