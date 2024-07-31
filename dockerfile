# Base Image: Start with a Nodejs base image
FROM node:20-alpine

# Setup directories
RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app
WORKDIR /home/node/app
COPY package*.json ./

# Install pnpm
RUN npm install -g pnpm

# Switch to node user
USER node

# Install node packages
RUN pnpm install

# Copy project
COPY --chown=node:node . .

# Setup config variables
RUN TOKEN="your token"
RUN CLIENTID="bot client ID"
RUN GUILDID="bot guild ID"
RUN OPSGUILD="operations guild ID"
RUN OPSCHANNEL="operations log channel ID"
RUN CASECHANNEL="case log channel ID"
RUN GUILDLIST="\"server id 1\", \"server id 2\""

# Setup config.json
RUN cp example/config_example.json config.json
RUN sed -i "s|<TOKEN>|$TOKEN|g" ./config.json
RUN sed -i "s|<CLIENT ID>|$CLIENTID|g" ./config.json
RUN sed -i "s|<GUILD ID>|$GUILDID|g" ./config.json
RUN sed -i "s|<OPS GUILD>|$OPSGUILD|g" ./config.json
RUN sed -i "s|<OPS CHANNEL>|$OPSCHANNEL|g" ./config.json
RUN sed -i "s|<CASE CHANNEL>|$CASECHANNEL|g" ./config.json
RUN sed -i "s|<GUILD LIST>|$GUILDLIST|g" ./config.json
RUN echo config.json

# Start the bot
CMD ["node", "index.js"]