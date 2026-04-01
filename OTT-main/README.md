# Planet analytics - insights
Integration of sentinel-hubs (insights) APIs and Planet analytics within a basic gis application (plain js+html+css), AMD is used in this project.

How to use:
cd to proxy-server and run npm install
you need a .env file with your sentinel-hub credentials and planet api key, en example is shown below:

```
CLIENT_ID="yourclientid"
CLIENT_SECRET="yoursecretclientid"
PL_API_KEY="yourplanetapikey"
```

Then run `node proxy-server.js`, the server will run in loaclhost:3000 by default

Proxy server is used to handle requests made to the external apis

once the server is runing and listening, you can open index.html and see the app running

keep in mind : Im importing planet Api key on my client using AMD, that way i can use it to add wmts layers from planet, do not use this approach. This is just for demo purposes.

PL_API_KEY.js:
```
 define([], function() {
    const PL_API_KEY="yourplanetapikey"
  
    return {
      myExtraSecretAPIKey: PL_API_KEY
    };
  });
```

