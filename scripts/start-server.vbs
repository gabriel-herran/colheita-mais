' Inicia o servidor Colheita+ em segundo plano (janela oculta).
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "D:\TCC\Colheita+ v1.0\Colheita+"
sh.Run """C:\Users\Blade\.tools\node-v24.19.0-win-x64\node.exe"" server.js", 0, False
