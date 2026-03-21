package com.codebuddy.plugin.ui

import com.codebuddy.plugin.api.CodeBuddyClient
import com.codebuddy.plugin.settings.CodeBuddySettings
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory

class ChatToolWindowFactory : ToolWindowFactory, DumbAware {

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val chatPanel = ChatPanel()
        ChatPanel.setActiveInstance(chatPanel)

        val content = ContentFactory.getInstance().createContent(chatPanel, "Chat", false)
        toolWindow.contentManager.addContent(content)

        // Auto-connect health check
        if (CodeBuddySettings.getInstance().autoConnect) {
            ApplicationManager.getApplication().executeOnPooledThread {
                val health = CodeBuddyClient.getInstance().healthCheck()
                if (!health.connected) {
                    javax.swing.SwingUtilities.invokeLater {
                        chatPanel.sendMessageFromAction(
                            "" // Don't auto-send, just check
                        )
                    }
                }
            }
        }
    }

    override fun shouldBeAvailable(project: Project): Boolean = true
}
