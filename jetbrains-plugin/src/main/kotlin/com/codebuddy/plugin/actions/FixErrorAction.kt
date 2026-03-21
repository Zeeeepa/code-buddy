package com.codebuddy.plugin.actions

import com.codebuddy.plugin.api.CodeBuddyClient
import com.codebuddy.plugin.ui.ChatPanel
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.wm.ToolWindowManager

class FixErrorAction : AnAction() {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val editor = e.getData(CommonDataKeys.EDITOR) ?: return
        val file = e.getData(CommonDataKeys.VIRTUAL_FILE) ?: return

        val document = editor.document
        val caretOffset = editor.caretModel.offset
        val lineNumber = document.getLineNumber(caretOffset)
        val fileName = file.name
        val language = file.extension ?: "text"

        // Get context around the error: 10 lines before and after cursor
        val startLine = maxOf(0, lineNumber - 10)
        val endLine = minOf(document.lineCount - 1, lineNumber + 10)
        val startOffset = document.getLineStartOffset(startLine)
        val endOffset = document.getLineEndOffset(endLine)
        val contextCode = document.getText(com.intellij.openapi.util.TextRange(startOffset, endOffset))

        // Check if there's selected text (error text)
        val selectedError = editor.selectionModel.selectedText

        val message = buildString {
            append("Fix the error in `$fileName` at line ${lineNumber + 1}")
            if (!selectedError.isNullOrBlank()) {
                append(".\n\nError message:\n```\n$selectedError\n```")
            }
            append("\n\nCode context (lines ${startLine + 1}-${endLine + 1}):\n```$language\n$contextCode\n```")
            append("\n\nProvide the corrected code and explain the fix.")
        }

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
