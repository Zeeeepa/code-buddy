package com.codebuddy.plugin.actions

import com.codebuddy.plugin.api.CodeBuddyClient
import com.codebuddy.plugin.ui.ChatPanel
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.wm.ToolWindowManager

class ReviewFileAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val editor = e.getData(CommonDataKeys.EDITOR) ?: return
        val file = e.getData(CommonDataKeys.VIRTUAL_FILE) ?: return

        val content = editor.document.text
        val fileName = file.name
        val language = file.extension ?: "text"

        // Truncate very large files
        val maxLen = 8000
        val truncated = if (content.length > maxLen) {
            content.substring(0, maxLen) + "\n\n... (truncated, ${content.length} total characters)"
        } else {
            content
        }

        val message = "Review the following $language file `$fileName` for bugs, code quality issues, and improvement suggestions:\n\n```$language\n$truncated\n```"

        ApplicationManager.getApplication().executeOnPooledThread {
            val health = CodeBuddyClient.getInstance().healthCheck()
            ApplicationManager.getApplication().invokeLater {
                if (!health.connected) {
                    Messages.showWarningDialog(
                        project,
                        "Cannot connect to Code Buddy server.",
                        "Code Buddy"
                    )
                    return@invokeLater
                }

                val toolWindow = ToolWindowManager.getInstance(project).getToolWindow("Code Buddy")
                toolWindow?.show {
                    ChatPanel.getActiveInstance()?.sendMessageFromAction(message)
                }
            }
        }
    }

    override fun update(e: AnActionEvent) {
        val editor = e.getData(CommonDataKeys.EDITOR)
        e.presentation.isEnabledAndVisible = e.project != null && editor != null
    }
}
