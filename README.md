# Discord Message Purge

A simple script for bulk deleting messages from a target Discord server.  
Built to run using [Deno](https://deno.land).

## Using

To use this script, follow these steps:

1. Place the script (msg-purge.js) and the config file (msg-purge.json) in a directory
2. Populate the config file with server ID, target user ID, and auth token
3. Run with[Deno](https://deno.land):
```deno run --allow-net --allow-read msg-purge.js```

Ensure you have the necessary permissions to delete messages in the target server. 


