' Abre o tunel ngrok para o site Colheita+ (porta 3000), janela oculta.
' Usa o ngrok instalado pela Microsoft Store (resolvido via PATH).
Set sh = CreateObject("WScript.Shell")
sh.Run "ngrok http --url=https://consuming-raving-recovery.ngrok-free.dev 3000", 0, False
