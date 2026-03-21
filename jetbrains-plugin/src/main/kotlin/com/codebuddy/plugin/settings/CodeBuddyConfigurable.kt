package com.codebuddy.plugin.settings

import com.intellij.openapi.options.Configurable
import com.intellij.ui.components.JBCheckBox
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBPasswordField
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.FormBuilder
import javax.swing.JComponent
import javax.swing.JPanel

class CodeBuddyConfigurable : Configurable {

    private var serverUrlField: JBTextField? = null
    private var apiKeyField: JBPasswordField? = null
    private var modelField: JBTextField? = null
    private var autoConnectCheckbox: JBCheckBox? = null
    private var mainPanel: JPanel? = null

    override fun getDisplayName(): String = "Code Buddy"

    override fun createComponent(): JComponent? {
        serverUrlField = JBTextField()
        apiKeyField = JBPasswordField()
        modelField = JBTextField()
        autoConnectCheckbox = JBCheckBox("Auto-connect on IDE startup")

        mainPanel = FormBuilder.createFormBuilder()
            .addLabeledComponent(JBLabel("Server URL:"), serverUrlField!!, 1, false)
            .addLabeledComponent(JBLabel("API Key:"), apiKeyField!!, 1, false)
            .addLabeledComponent(JBLabel("Model:"), modelField!!, 1, false)
            .addComponent(autoConnectCheckbox!!, 1)
            .addComponentFillVertically(JPanel(), 0)
            .panel

        reset()
        return mainPanel
    }

    override fun isModified(): Boolean {
        val settings = CodeBuddySettings.getInstance()
        return serverUrlField?.text != settings.serverUrl
                || String(apiKeyField?.password ?: charArrayOf()) != settings.apiKey
                || modelField?.text != settings.model
                || autoConnectCheckbox?.isSelected != settings.autoConnect
    }

    override fun apply() {
        val settings = CodeBuddySettings.getInstance()
        val state = settings.state
        state.serverUrl = serverUrlField?.text ?: "http://localhost:3000"
        state.apiKey = String(apiKeyField?.password ?: charArrayOf())
        state.model = modelField?.text ?: ""
        state.autoConnect = autoConnectCheckbox?.isSelected ?: true
        settings.loadState(state)
    }

    override fun reset() {
        val settings = CodeBuddySettings.getInstance()
        serverUrlField?.text = settings.serverUrl
        apiKeyField?.text = settings.apiKey
        modelField?.text = settings.model
        autoConnectCheckbox?.isSelected = settings.autoConnect
    }

    override fun disposeUIResources() {
        serverUrlField = null
        apiKeyField = null
        modelField = null
        autoConnectCheckbox = null
        mainPanel = null
    }
}
