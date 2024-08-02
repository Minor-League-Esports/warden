job "warden" {
    group "warden" {
        task "bot" {
            driver = "docker"

            config {
                image = ""
            }

            template {
                destination = "local/config.json"
                data = <<EOF
                    {
                        "token": "<TOKEN>",
                        "clientId": "<CLIENT ID>",
                        "guildId": "<GUILD ID>",
                        "opsGuild": "<OPS GUILD>",
                        "opsLogChannelId": "<OPS CHANNEL>",
                        "caseLogChannelId": "<CASE CHANNEL>",
                        "guildList": [<GUILD LIST>]
                    }
                EOF
            }
        }
    }
}