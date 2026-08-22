package app.vairagya.notifications

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "NotificationListener")
class NotificationListenerPlugin : Plugin() {

    companion object {

        private const val TAG = "VairagyaNotif"

        @Volatile
        private var instance: NotificationListenerPlugin? = null

        private val pending = ArrayList<JSObject>()

        fun emit(payload: JSObject) {
            instance?.context?.let { ctx ->
                try {
                    NotificationQueue.push(ctx, payload)
                } catch (e: Exception) {
                    Log.e(TAG, "QUEUE_PERSIST_FAILED", e)
                }
            }

            val plugin = instance

            if (plugin != null) {
                Log.d(TAG, "BRIDGE_EMIT $payload")
                plugin.notifyListeners(
                    "notificationReceived",
                    payload,
                    true
                )
            } else {
                synchronized(pending) {
                    if (pending.size >= 200) {
                        pending.removeAt(0)
                    }

                    pending.add(payload)

                    Log.d(
                        TAG,
                        "BRIDGE_NOT_READY queued=${pending.size}"
                    )
                }
            }
        }

        private fun drain(plugin: NotificationListenerPlugin) {

            val queued: List<JSObject>

            synchronized(pending) {
                queued = ArrayList(pending)
                pending.clear()
            }

            Log.d(
                TAG,
                "BRIDGE_DRAIN count=${queued.size}"
            )

            queued.forEach {
                plugin.notifyListeners(
                    "notificationReceived",
                    it,
                    true
                )
            }
        }
    }

    override fun load() {
        super.load()

        instance = this

        Log.d(TAG, "PLUGIN_LOADED")

        drain(this)
    }

    override fun handleOnResume() {
        super.handleOnResume()

        Log.d(TAG, "PLUGIN_RESUMED")

        drain(this)
    }

    override fun handleOnDestroy() {
        Log.d(TAG, "PLUGIN_DESTROYED")

        if (instance === this) {
            instance = null
        }

        super.handleOnDestroy()
    }

    private fun isEnabled(): Boolean {

        val flat = Settings.Secure.getString(
            context.contentResolver,
            "enabled_notification_listeners"
        ) ?: return false

        val expected = ComponentName(
            context,
            VairagyaNotificationService::class.java
        )

        return flat
            .split(":")
            .any { item ->

                val component =
                    ComponentName.unflattenFromString(item)

                component != null &&
                    component.packageName == expected.packageName &&
                    component.className == expected.className
            }
    }

    @PluginMethod
    fun getPendingNotifications(call: PluginCall) {
        try {
            val messages = NotificationQueue.drain(context)
            val arr = com.getcapacitor.JSArray()

            messages.forEach {
                arr.put(it)
            }

            call.resolve(
                JSObject().apply {
                    put("notifications", arr)
                }
            )

            Log.d(
                TAG,
                "getPendingNotifications -> ${messages.size}"
            )

        } catch (e: Exception) {

            Log.e(
                TAG,
                "getPendingNotifications failed",
                e
            )

            call.resolve(
                JSObject().apply {
                    put(
                        "notifications",
                        com.getcapacitor.JSArray()
                    )
                }
            )
        }
    }

    @PluginMethod
    fun checkPermission(call: PluginCall) {

        val granted = isEnabled()

        Log.d(
            TAG,
            "CHECK_PERMISSION granted=$granted"
        )

        call.resolve(
            JSObject().apply {
                put("granted", granted)
            }
        )
    }

    @PluginMethod
    fun requestPermission(call: PluginCall) {

        Log.d(
            TAG,
            "OPENING_NOTIFICATION_ACCESS_SETTINGS"
        )

        val intent = Intent(
            Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS
        ).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        context.startActivity(intent)

        call.resolve(
            JSObject().apply {
                put("opened", true)
            }
        )
    }

    @PluginMethod
    fun startListening(call: PluginCall) {

        val enabled = isEnabled()

        Log.d(
            TAG,
            "START_LISTENING enabled=$enabled"
        )

        drain(this)

        call.resolve(
            JSObject().apply {
                put(
                    "listening",
                    enabled
                )
            }
        )
    }
}
