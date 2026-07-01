#ifndef MyAppVersion
#define MyAppVersion "development"
#endif

#define MyAppName "NPSharp"
#define MyAppPublisher "CoreLabs"
#define MyAppLauncher "run-npsharp.bat"

[Setup]
AppId={{8A27B871-BFF8-4D93-A96B-8659C4473E27}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL=https://corelabs.dev.br
AppSupportURL=https://corelabs.dev.br
AppUpdatesURL=https://github.com/CorelabsBR/CL_NPSharp/releases
DefaultDirName={autopf}\NPSharp
DefaultGroupName=NPSharp
DisableProgramGroupPage=yes
OutputDir=..\dist\installer
OutputBaseFilename=NPSharp-Setup
Compression=lzma
SolidCompression=yes
UninstallDisplayName={#MyAppName}
WizardStyle=modern
LicenseFile=..\LICENSE

#ifexist "..\src\main\resources\icons\app.ico"
SetupIconFile=..\src\main\resources\icons\app.ico
UninstallDisplayIcon={app}\app.ico
#endif

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\dist\windows\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

#ifexist "..\src\main\resources\icons\app.ico"
Source: "..\src\main\resources\icons\app.ico"; DestDir: "{app}"; DestName: "app.ico"; Flags: ignoreversion
#endif

[Icons]
#ifexist "..\src\main\resources\icons\app.ico"
Name: "{group}\NPSharp"; Filename: "{app}\{#MyAppLauncher}"; WorkingDir: "{app}"; IconFilename: "{app}\app.ico"
Name: "{autodesktop}\NPSharp"; Filename: "{app}\{#MyAppLauncher}"; WorkingDir: "{app}"; IconFilename: "{app}\app.ico"; Tasks: desktopicon
#else
Name: "{group}\NPSharp"; Filename: "{app}\{#MyAppLauncher}"; WorkingDir: "{app}"
Name: "{autodesktop}\NPSharp"; Filename: "{app}\{#MyAppLauncher}"; WorkingDir: "{app}"; Tasks: desktopicon
#endif

[Run]
Filename: "{app}\{#MyAppLauncher}"; Description: "{cm:LaunchProgram,NPSharp}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"