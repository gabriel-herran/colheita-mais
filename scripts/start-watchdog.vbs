' Inicia o vigia do Colheita+ (mantem o servidor local no ar), janela oculta.
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "D:\TCC\Colheita+ v1.0\Colheita+"
sh.Run """C:\Users\Blade\.tools\node-v24.19.0-win-x64\node.exe"" scripts\watchdog.js", 0, False
