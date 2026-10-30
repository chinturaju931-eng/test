Option Explicit
Dim shell, fs, folder, base, i, response, code, stream, env
Set shell = CreateObject("WScript.Shell")
Set fs = CreateObject("Scripting.FileSystemObject")
folder = fs.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = folder
base = "http://127.0.0.1:3000"

Function Health()
  Dim http
  Health = ""
  On Error Resume Next
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  http.setTimeouts 1000, 1000, 1000, 1000
  http.open "GET", base & "/api/health", False
  http.send
  If Err.Number = 0 Then
    If http.status = 200 Then Health = http.responseText
  End If
  On Error GoTo 0
End Function

response = Health()
If InStr(response, """app"":""commuteads""") = 0 Then
  If shell.Run("cmd /c where node >nul 2>nul", 0, True) <> 0 Then
    MsgBox "Install Node.js 22 or newer, then double-click OPEN-DASHBOARD again.", 48, "Commute Ads"
    WScript.Quit 1
  End If
  Set env = shell.Environment("PROCESS")
  env("HOST") = "127.0.0.1"
  env("PORT") = "3000"
  env("NODE_ENV") = "development"
  env("DATA_DIR") = folder & "\.data"
  On Error Resume Next
  shell.Run "node.exe """ & folder & "\server.js""", 0, False
  If Err.Number <> 0 Then
    MsgBox "Could not start the app. Use START-WINDOWS.bat to see the error.", 48, "Commute Ads"
    WScript.Quit 1
  End If
  On Error GoTo 0
End If

For i = 1 To 30
  response = Health()
  If InStr(response, """app"":""commuteads""") > 0 Then
    code = ""
    If fs.FileExists(folder & "\.data\setup-code.txt") Then
      Set stream = fs.OpenTextFile(folder & "\.data\setup-code.txt", 1)
      code = Trim(stream.ReadAll)
      stream.Close
    End If
    If code <> "" Then base = base & "/#setup=" & code
    shell.Run base, 1, False
    WScript.Quit 0
  End If
  WScript.Sleep 500
Next
MsgBox "The app did not start. Close any older Commute Ads window and try again. Use START-WINDOWS.bat to see startup errors.", 48, "Commute Ads"
WScript.Quit 1
