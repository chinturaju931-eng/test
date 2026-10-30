Option Explicit
Dim fs, folder, service, processes, process, target
Set fs = CreateObject("Scripting.FileSystemObject")
folder = fs.GetParentFolderName(WScript.ScriptFullName)
target = """" & LCase(folder & "\server.js") & """"
On Error Resume Next
Set service = GetObject("winmgmts:\\.\root\cimv2")
Set processes = service.ExecQuery("SELECT * FROM Win32_Process WHERE Name='node.exe'")
For Each process In processes
  If Not IsNull(process.CommandLine) Then
    If InStr(LCase(process.CommandLine), target) > 0 Then process.Terminate
  End If
Next
If Err.Number <> 0 Then
  MsgBox "Windows could not stop the background app. Restarting your computer will also stop it.", 48, "Commute Ads"
Else
  MsgBox "Stopped background app processes started from this folder.", 64, "Commute Ads"
End If
On Error GoTo 0
