package com.codebuddy.plugin.actions

import com.codebuddy.plugin.api.CodeBuddyClient
import com.codebuddy.plugin.ui.ChatPanel
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.wm.ToolWindowManager

class ExplainCodeAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val editor = e.getData(CommonDataKeys.EDITOR) ?: return
        val selectedText = editor.selectionModel.selectedText

        if (selectedText.isNullOrBlank()) {
            Messages.showInfoMessage(project, "Please select some code first.", "Code Buddy")
            return
        }

        val file = e.getData(CommonDataKeys.VIRTUAL_FILE)
        val fileName = file?.name ?: "unknown"
        val language = file?.extension ?: "text"

        val message = "Explain the following $language code from `$fileName`:\n\n```$language\n$selectedText\n```"

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
        e.presentation.isEnabledAndVisible = e.project != null && editor != null && editor.selectionModel.hasSelection()
    }
}
