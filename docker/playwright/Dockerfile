FROM mcr.microsoft.com/playwright:v1.56.1

SHELL ["/bin/bash", "-o", "pipefail", "-c"]
WORKDIR /app

ARG NODE_VERSION=24

# hadolint ignore=DL3008
RUN apt-get remove -y nodejs && \
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - && \
    apt-get install -y --no-install-recommends \
    nodejs \
    jq \
    perl \
    unzip \
    && \
    curl -fsSL -o /tmp/google-chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
    apt-get install -y --no-install-recommends /tmp/google-chrome.deb || apt-get -f install -y --no-install-recommends && \
    rm /tmp/google-chrome.deb && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    npm install -g npm@latest && \
    node -v && npm -v
