package app.vairagya.notifications

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Bridges Android's NotificationListenerService into the Vairagya web
 * layer so transaction notifications from PhonePe / GPay / Paytm / BHIM
 * and banking apps can be parsed and stored.
 *
 * JS side: src/native/notification-listener.ts
 */
@CapacitorPlugin(name = "NotificationListener")
class NotificationListenerPlugin : Plugin() {

    companion object {
        @Volatile
        private var instance: NotificationListenerPlugin? = null

        /** Notifications posted before the JS layer attached. */
        private val pending = ArrayList<JSObject>()

        /** Called from VairagyaNotificationService for every posted notification. */
        fun emit(payload: JSObject) {
    val plugin = instance

    if (plugin != null) {
        android.util.Log.d(
            "VairagyaNotif",
            "BRIDGE EMIT: ${payload}"
        )

        plugin.notifyListeners(
            "notificationReceived",
            payload,
            true
        )
    } else {
        android.util.Log.d(
            "VairagyaNotif",
            "BRIDGE NOT READY — QUEUING: ${payload}"
        )

        synchronized(pending) {
            if (pending.size > 200) {
                pending.removeAt(0)
            }
            pending.add(payload)
        }
    }
}

        private fun drain(plugin: NotificationListenerPlugin) {
            val queued: List<JSObject>
            synchronized(pending) {
                queued = ArrayList(pending)
                pending.clear()
            }
            queued.forEach { plugin.notifyListeners("notificationReceived", it, true) }
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

    private fun isEnabled(): Boolean {
        val ctx: Context = context
        val flat = Settings.Secure.getString(
            ctx.contentResolver,
            "enabled_notification_listeners"
        ) ?: return false
        val expected = ComponentName(ctx, VairagyaNotificationService::class.java)
        return flat.split(":").any {
            val cn = ComponentName.unflattenFromString(it)
            cn != null && cn.packageName == expected.packageName &&
                cn.className == expected.className
        }
    }

    @PluginMethod
    fun checkPermission(call: PluginCall) {
        val res = JSObject()
        res.put("granted", isEnabled())
        call.resolve(res)
    }

    /**
     * Android offers no in-app dialog for notification access; the only
     * path is the system settings screen.
     */
    @PluginMethod
    fun requestPermission(call: PluginCall) {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        val res = JSObject()
        res.put("opened", true)
        call.resolve(res)
    }

    @PluginMethod
    fun startListening(call: PluginCall) {
        drain(this)
        // The service is started by the OS once access is granted; this
        // method exists so JS can confirm the bridge is alive.
        val res = JSObject()
        res.put("listening", isEnabled())
        call.resolve(res)
    }
}
