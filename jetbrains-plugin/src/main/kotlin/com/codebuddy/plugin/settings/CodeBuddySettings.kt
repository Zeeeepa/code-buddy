package com.codebuddy.plugin.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage

@Service(Service.Level.APP)
@State(
    name = "CodeBuddySettings",
    storages = [Storage("CodeBuddyPlugin.xml")]
)
class CodeBuddySettings : PersistentStateComponent<CodeBuddySettings.State> {

    data class State(
        var serverUrl: String = "http://localhost:3000",
        var apiKey: String = "",
        var model: String = "",
        var autoConnect: Boolean = true
    )

    private var myState = State()

    override fun getState(): State = myState

    override fun loadState(state: State) {
        myState = state
    }

    val serverUrl: String get() = myState.serverUrl
    val apiKey: String get() = myState.apiKey
    val model: String get() = myState.model
    val autoConnect: Boolean get() = myState.autoConnect

    companion object {
        fun getInstance(): CodeBuddySettings {
            return ApplicationManager.getApplication().getService(CodeBuddySettings::class.java)
        }
    }
}
