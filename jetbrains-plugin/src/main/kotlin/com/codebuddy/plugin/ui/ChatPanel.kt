package com.codebuddy.plugin.ui

import com.codebuddy.plugin.api.CodeBuddyClient
import com.intellij.openapi.application.ApplicationManager
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.components.JBTextArea
import java.awt.BorderLayout
import java.awt.Dimension
import java.awt.Font
import javax.swing.JButton
import javax.swing.JEditorPane
import javax.swing.JPanel
import javax.swing.SwingUtilities
import javax.swing.text.html.HTMLEditorKit
import javax.swing.text.html.StyleSheet

class ChatPanel : JPanel(BorderLayout()) {

    private val messagesPane: JEditorPane
    private val inputArea: JBTextArea
    private val sendButton: JButton
    private val messages = StringBuilder()
    private var messageCount = 0

    init {
        // Messages display
        messagesPane = JEditorPane().apply {
            isEditable = false
            contentType = "text/html"
            val kit = HTMLEditorKit()
            val style = StyleSheet()
            style.addRule("body { font-family: 'JetBrains Mono', monospace, sans-serif; font-size: 13px; margin: 8px; }")
            style.addRule(".user { background-color: #2b5278; color: #e0e0e0; padding: 8px 12px; border-radius: 8px; margin: 4px 0; }")
            style.addRule(".assistant { background-color: #3c3f41; color: #e0e0e0; padding: 8px 12px; border-radius: 8px; margin: 4px 0; }")
            style.addRule(".error { background-color: #5c2020; color: #ff8080; padding: 8px 12px; border-radius: 8px; margin: 4px 0; }")
            style.addRule("pre { background-color: #1e1e1e; padding: 8px; border-radius: 4px; overflow-x: auto; font-family: 'JetBrains Mono', monospace; font-size: 12px; }")
            style.addRule("code { background-color: #1e1e1e; padding: 2px 4px; border-radius: 2px; font-family: 'JetBrains Mono', monospace; font-size: 12px; }")
            kit.styleSheet = style
            editorKit = kit
        }
        val scrollPane = JBScrollPane(messagesPane)

        // Input area
        inputArea = JBTextArea(3, 40).apply {
            lineWrap = true
            wrapStyleWord = true
            font = Font("JetBrains Mono", Font.PLAIN, 13)
            emptyText.text = "Ask Code Buddy..."
        }
        val inputScroll = JBScrollPane(inputArea).apply {
            preferredSize = Dimension(0, 80)
        }

        sendButton = JButton("Send").apply {
            addActionListener { sendMessage() }
        }

        // Input panel (text area + send button)
        val inputPanel = JPanel(BorderLayout(4, 0)).apply {
            add(inputScroll, BorderLayout.CENTER)
            add(sendButton, BorderLayout.EAST)
        }

        add(scrollPane, BorderLayout.CENTER)
        add(inputPanel, BorderLayout.SOUTH)

        // Enter key sends (Shift+Enter for newline)
        inputArea.addKeyListener(object : java.awt.event.KeyAdapter() {
            override fun keyPressed(e: java.awt.event.KeyEvent) {
                if (e.keyCode == java.awt.event.KeyEvent.VK_ENTER && !e.isShiftDown) {
                    e.consume()
                    sendMessage()
                }
            }
        })

        updateMessages()
    }

    private fun sendMessage() {
        val text = inputArea.text.trim()
        if (text.isEmpty()) return

        inputArea.text = ""
        inputArea.isEnabled = false
        sendButton.isEnabled = false
        appendMessage("user", text)

        ApplicationManager.getApplication().executeOnPooledThread {
            val client = CodeBuddyClient.getInstance()
            val response = client.chat(text)

            SwingUtilities.invokeLater {
                inputArea.isEnabled = true
                sendButton.isEnabled = true
                inputArea.requestFocusInWindow()

                if (response.error != null) {
                    appendMessage("error", "Error: ${response.error}")
                } else {
                    appendMessage("assistant", response.reply)
                }
            }
        }
    }

    fun sendMessageFromAction(message: String) {
        appendMessage("user", message)
        inputArea.isEnabled = false
        sendButton.isEnabled = false

        ApplicationManager.getApplication().executeOnPooledThread {
            val client = CodeBuddyClient.getInstance()
            val response = client.chat(message)

            SwingUtilities.invokeLater {
                inputArea.isEnabled = true
                sendButton.isEnabled = true

                if (response.error != null) {
                    appendMessage("error", "Error: ${response.error}")
                } else {
                    appendMessage("assistant", response.reply)
                }
            }
        }
    }

    private fun appendMessage(role: String, content: String) {
        messageCount++
        val label = when (role) {
            "user" -> "You"
            "assistant" -> "Code Buddy"
            "error" -> "Error"
            else -> role
        }
        val htmlContent = markdownToHtml(escapeHtml(content))
        messages.append("<div class=\"$role\"><b>$label:</b><br/>$htmlContent</div><br/>")
        updateMessages()
    }

    private fun updateMessages() {
        val html = "<html><body>${messages}</body></html>"
        messagesPane.text = html
        // Scroll to bottom
        SwingUtilities.invokeLater {
            messagesPane.caretPosition = messagesPane.document.length
        }
    }

    private fun escapeHtml(text: String): String {
        return text
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
    }

    private fun markdownToHtml(text: String): String {
        val lines = text.split("\n")
        val result = StringBuilder()
        var inCodeBlock = false
        var codeContent = StringBuilder()

        for (line in lines) {
            if (line.trimStart().startsWith("```")) {
                if (inCodeBlock) {
                    result.append("<pre><code>${codeContent}</code></pre>")
                    codeContent = StringBuilder()
                    inCodeBlock = false
                } else {
                    inCodeBlock = true
                }
                continue
            }

            if (inCodeBlock) {
                if (codeContent.isNotEmpty()) codeContent.append("\n")
                codeContent.append(line)
                continue
            }

            var processed = line
            // Inline code
            processed = processed.replace(Regex("`([^`]+)`"), "<code>$1</code>")
            // Bold
            processed = processed.replace(Regex("\\*\\*([^*]+)\\*\\*"), "<b>$1</b>")
            // Italic
            processed = processed.replace(Regex("\\*([^*]+)\\*"), "<i>$1</i>")
            // Headers
            processed = when {
                processed.startsWith("### ") -> "<h3>${processed.substring(4)}</h3>"
                processed.startsWith("## ") -> "<h2>${processed.substring(3)}</h2>"
                processed.startsWith("# ") -> "<h1>${processed.substring(2)}</h1>"
                else -> processed
            }

            result.append(processed)
            if (!processed.startsWith("<h")) {
                result.append("<br/>")
            }
        }

        // Close unclosed code block
        if (inCodeBlock) {
            result.append("<pre><code>${codeContent}</code></pre>")
        }

        return result.toString()
    }

    companion object {
        private var activeInstance: ChatPanel? = null

        fun getActiveInstance(): ChatPanel? = activeInstance

        fun setActiveInstance(panel: ChatPanel) {
            activeInstance = panel
        }
    }
}
