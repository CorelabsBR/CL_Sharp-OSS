package br.com.corelabs.npsharpfx.frontend.theme.mobile

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.concurrent.CopyOnWriteArraySet

object ThemeManager {
    private const val PREFS = "npsharp_theme"
    private const val PREF_THEME_ASSET = "theme_asset"
    private const val THEME_DIR = "themes"

    private val observers = CopyOnWriteArraySet<ThemeObserver>()
    private val themesByAsset = linkedMapOf<String, ThemeModel>()
    private lateinit var appContext: Context
    private lateinit var prefs: SharedPreferences

    private val _currentTheme = MutableStateFlow(ThemeModel.Default)

    @JvmStatic
    val currentThemeFlow: StateFlow<ThemeModel> = _currentTheme.asStateFlow()

    @JvmStatic
    val currentTheme: ThemeModel
        get() = _currentTheme.value

    @JvmStatic
    fun initialize(context: Context) {
        appContext = context.applicationContext
        prefs = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        reloadThemes()
        val saved = prefs.getString(PREF_THEME_ASSET, null)
        val restored = saved?.let { themesByAsset[it] }
            ?: themesByAsset["dark.json"]
            ?: themesByAsset.values.firstOrNull()
            ?: ThemeModel.Default
        publish(restored, persist = false)
    }

    @JvmStatic
    fun reloadThemes() {
        checkInitialized()
        themesByAsset.clear()
        val assets = appContext.assets.list(THEME_DIR).orEmpty()
            .filter { it.endsWith(".json") && it != "package.json" }
            .sortedWith(compareBy<String> { priority(it) }.thenBy { it.lowercase() })

        for (asset in assets) {
            runCatching {
                val json = appContext.assets.open("$THEME_DIR/$asset")
                    .bufferedReader()
                    .use { it.readText() }
                ThemeJsonParser.parse(asset, json)
            }.onSuccess { theme ->
                themesByAsset[asset] = theme
            }
        }
        if (themesByAsset.isEmpty()) {
            themesByAsset[ThemeModel.Default.assetName] = ThemeModel.Default
        }
    }

    @JvmStatic
    fun availableThemes(): List<ThemeModel> {
        checkInitialized()
        return themesByAsset.values.toList()
    }

    @JvmStatic
    fun availableThemeNames(): Array<String> {
        return availableThemes().map { it.name }.toTypedArray()
    }

    @JvmStatic
    fun assetNameAt(index: Int): String {
        return availableThemes().getOrNull(index)?.assetName ?: currentTheme.assetName
    }

    @JvmStatic
    fun setThemeByAsset(assetName: String): Boolean {
        checkInitialized()
        val theme = themesByAsset[assetName] ?: return false
        publish(theme, persist = true)
        return true
    }

    @JvmStatic
    fun setThemeByName(name: String): Boolean {
        checkInitialized()
        val theme = themesByAsset.values.firstOrNull { it.name == name || it.id == name } ?: return false
        publish(theme, persist = true)
        return true
    }

    @JvmStatic
    fun addObserver(observer: ThemeObserver, notifyNow: Boolean) {
        observers.add(observer)
        if (notifyNow) observer.onThemeChanged(currentTheme)
    }

    @JvmStatic
    fun removeObserver(observer: ThemeObserver) {
        observers.remove(observer)
    }

    @JvmStatic
    fun restoreSavedTheme() {
        checkInitialized()
        val asset = prefs.getString(PREF_THEME_ASSET, null) ?: return
        setThemeByAsset(asset)
    }

    private fun publish(theme: ThemeModel, persist: Boolean) {
        _currentTheme.value = theme
        if (persist) {
            prefs.edit().putString(PREF_THEME_ASSET, theme.assetName).apply()
        }
        observers.forEach { it.onThemeChanged(theme) }
    }

    private fun priority(asset: String): Int {
        return when (asset) {
            "dark.json" -> 0
            "light.json" -> 1
            "nord.json" -> 2
            "synthwave.json" -> 3
            else -> 10
        }
    }

    private fun checkInitialized() {
        if (!::appContext.isInitialized) {
            error("ThemeManager.initialize(context) must be called before use.")
        }
    }
}
