package com.codebuddy.plugin.ui

import com.codebuddy.plugin.api.CodeBuddyClient
import com.codebuddy.plugin.settings.CodeBuddySettings
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.StatusBarWidgetFactory
import com.intellij.util.Consumer
import java.awt.event.MouseEvent
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

class CodeBuddyStatusBarWidgetFactory : StatusBarWidgetFactory {

    override fun getId(): String = "CodeBuddyStatus"

    override fun getDisplayName(): String = "Code Buddy Status"

    override fun isAvailable(project: Project): Boolean = true

    override fun createWidget(project: Project): StatusBarWidget {
        return CodeBuddyStatusBarWidget()
    }

    override fun disposeWidget(widget: StatusBarWidget) {
        (widget as? CodeBuddyStatusBarWidget)?.dispose()
    }
}

class CodeBuddyStatusBarWidget : StatusBarWidget, StatusBarWidget.TextPresentation {

    private var statusBar: StatusBar? = null
    private var connected = false
    private var modelName: String? = null
    private val scheduler = Executors.newSingleThreadScheduledExecutor()
    private var pollingTask: ScheduledFuture<*>? = null

    override fun ID(): String = "CodeBuddyStatus"

    override fun install(statusBar: StatusBar) {
        this.statusBar = statusBar
        startPolling()
    }

    override fun dispose() {
        pollingTask?.cancel(true)
        scheduler.shutdown()
    }

    override fun getPresentation(): StatusBarWidget.WidgetPresentation = this

    override fun getText(): String {
        return if (connected) {
            val model = modelName ?: CodeBuddySettings.getInstance().model
            if (model.isNotBlank()) "CB: $model" else "CB: Connected"
        } else {
            "CB: Disconnected"
        }
    }

    override fun getAlignment(): Float = 0f

    override fun getTooltipText(): String {
        return if (connected) {
            "Code Buddy connected to ${CodeBuddySettings.getInstance().serverUrl}"
        } else {
            "Code Buddy not connected. Check server at ${CodeBuddySettings.getInstance().serverUrl}"
        }
    }

    override fun getClickConsumer(): Consumer<MouseEvent>? = null

    private fun startPolling() {
        if (CodeBuddySettings.getInstance().autoConnect) {
            checkConnection()
        }
        pollingTask = scheduler.scheduleWithFixedDelay({
            checkConnection()
        }, 30, 30, TimeUnit.SECONDS)
    }

    private fun checkConnection() {
        ApplicationManager.getApplication().executeOnPooledThread {
            val health = CodeBuddyClient.getInstance().healthCheck()
            connected = health.connected
            modelName = health.model
            statusBar?.updateWidget(ID())
        }
    }
}
