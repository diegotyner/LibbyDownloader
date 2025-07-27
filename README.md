# LibbyDownloader


Run `pip install -r requirements.txt` as well as doing the following in your (im assuming debian) environment to install a chrome webdriver for selenium:

```
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
apt-get install -y ./google-chrome-stable_current_amd64.deb
```

Additionally, it will be necessary to supply authorization cookies locally (to bypass auth checks). I will be using the "Get cookies.txt LOCALLY" chrome browser extension.
- NOTE: Cookies will need to be gotten somewhat briefly before running the script. Cookies routinely expire and are required to be regenerated.