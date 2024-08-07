job "warden" {
  namespace = "MLE"
  vault {
    policies = ["nomad"]
    change_mode = "restart"
    disable_file = true
  }
  group "bot" {
    task "discord" {
      driver = "docker"
      config {
        image = "actualsovietshark/mle-warden:latest" # TODO Build image?
        entrypoint = [ "sh" ] 
        args = ["-c", "cp /local/config.json /home/node/app/config.json && node index.js"]
      }
      template {
        perms = "444"
        destination = "local/config.json"
        data = <<EOF
{
{{ with secret "kv2/data/nomad/mle/warden" }}
  "token": "{{ .Data.data.token }}",
  "clientId": "{{ .Data.data.clientId }}",
{{ end }}

{{ with $d := key "minor-league-esports/warden" | parseJSON }}
  "opsGuild": "{{ $d.opsGuild }}",
  "caseLogChannelId": "{{ $d.caseLogChannelId }}",
  "opsLogChannelId": "{{ $d.opsLogChannelId }}",
  "guildList": {{ $d.guildList }},
  "guildId": "{{ $d.guildId }}"
{{ end }}
}

        EOF
      }
    }
  }
}
