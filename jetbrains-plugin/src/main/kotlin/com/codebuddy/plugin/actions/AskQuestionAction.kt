package com.codebuddy.plugin.actions

import com.codebuddy.plugin.api.CodeBuddyClient
import com.codebuddy.plugin.ui.ChatPanel
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.wm.ToolWindowManager

class AskQuestionAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return

        // Check connection first
        ApplicationManager.getApplication().executeOnPooledThread {
            val health = CodeBuddyClient.getInstance().healthCheck()
            ApplicationManager.getApplication().invokeLater {
                if (!health.connected) {
                    Messages.showWarningDialog(
                        project,
                        "Cannot connect to Code Buddy server. Please check that the server is running.",
                        "Code Buddy"
                    )
                    return@invokeLater
                }

                val question = Messages.showInputDialog(
                    project,
                    "What would you like to ask?",
                    "Ask Code Buddy",
                    Messages.getQuestionIcon()
                )

                if (!question.isNullOrBlank()) {
                    openToolWindowAndSend(project, question)
                }
            }
        }
    }

    private fun openToolWindowAndSend(project: com.intellij.openapi.project.Project, message: String) {
        val toolWindow = ToolWindowManager.getInstance(project).getToolWindow("Code Buddy")
        toolWindow?.show {
            ChatPanel.getActiveInstance()?.sendMessageFromAction(message)
        }
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabledAndVisible = e.project != null
    }
}
