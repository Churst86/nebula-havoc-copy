$repo = "https://github.com/Churst86/nebula-havoc-copy"
$workflowPath = "/actions/workflows/manual-release.yml"
$url = "$repo$workflowPath"

Write-Host "Opening Manual Desktop Release workflow page..."
Write-Host $url
Start-Process $url
