import { log } from "console";
import "dotenv/config";
import { createServer } from "http";
import fetch from "node-fetch";
import { URLSearchParams, parse } from "url";
const PORT = process.env.PORT || 3000;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const PL_API_KEY = process.env.PL_API_KEY;
const ANALYTICS_ITEMS_PAGE_LIMIT = 1000;
const ANALYTICS_MAX_RETRIES = 5;
const ANALYTICS_BASE_RETRY_DELAY_MS = 1200;
const analyticsProgressStore = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelayMs = (response, attempt) => {
  const retryAfterHeader = response.headers.get("retry-after");

  if (retryAfterHeader) {
    const retryAfterSeconds = Number(retryAfterHeader);
    if (Number.isFinite(retryAfterSeconds)) {
      return retryAfterSeconds * 1000;
    }
  }

  return ANALYTICS_BASE_RETRY_DELAY_MS * 2 ** attempt;
};

const fetchPlanetAnalyticsPage = async (url) => {
  for (let attempt = 0; attempt <= ANALYTICS_MAX_RETRIES; attempt++) {
    const planetResponse = await fetch(url, {
      headers: {
        Authorization: `api-key ${PL_API_KEY}`,
      },
    });

    if (planetResponse.ok) {
      return planetResponse;
    }

    if (planetResponse.status === 429 && attempt < ANALYTICS_MAX_RETRIES) {
      const retryDelayMs = getRetryDelayMs(planetResponse, attempt);
      await sleep(retryDelayMs);
      continue;
    }

    throw new Error(
      `Failed to fetch data from Planet API: ${planetResponse.status} ${planetResponse.statusText}`
    );
  }

  throw new Error("Failed to fetch data from Planet API after retries");
};

const getAnalyticsNextLink = (pageData) => {
  const linksArray = Array.isArray(pageData?.links)
    ? pageData.links
    : Array.isArray(pageData?._links)
    ? pageData._links
    : [];

  const nextLinkObject = linksArray.find((link) => {
    return link?.rel === "next" && typeof link?.href === "string";
  });

  return (
    pageData?._links?._next ||
    pageData?._links?.next ||
    pageData?.links?.next ||
    nextLinkObject?.href ||
    pageData?.next ||
    null
  );
};

if (!CLIENT_ID || !CLIENT_SECRET || !PL_API_KEY) {
  console.error(
    "Please provide both SENTINEL CLIENT_ID, SENTINEL CLIENT_SECRET  and PL_API_KEY in the .env file"
  );
  process.exit(1);
}

const getToken = async () => {
  try {
    const response = await fetch(
      "https://services.sentinel-hub.com/auth/realms/main/protocol/openid-connect/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: "client_credentials",
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error_description || "Failed to fetch token");
    }

    return data.access_token;
  } catch (error) {
    console.error("Error fetching token:", error);
    throw error;
  }
};

const server = createServer(async (req, res) => {
  // Allow requests from any origin
  res.setHeader("Access-Control-Allow-Origin", "*");
  // Allow certain headers to be sent by the client
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  } else if (req.url === "/get-statistics" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const token = await getToken();
        const statisticsResponse = await fetch(
          "https://services.sentinel-hub.com/api/v1/statistics",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: body,
          }
        );

        const statisticsData = await statisticsResponse.json();
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(statisticsData));
      } catch (error) {
        console.error("Error fetching statistics:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to fetch statistics" }));
      }
    });
  } 

  else if (req.url == "/get-catalog" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    
    req.on("end", async () => {
      try {
        const token = await getToken();
        var json = JSON.parse(body)
        //var implementation = json.implementation
        //delete json.implementation
        //var url;
   
        /*
        if (implementation === "UE"){
          url = "https://services.sentinel-hub.com/api/v1/catalog/1.0.0/search"
        }else if(implementation === "CREO"){
          url = "https://creodias.sentinel-hub.com/api/v1/catalog/1.0.0/search"
        }else if(implementation === "US-WEST"){
          url = "https://services-uswest2.sentinel-hub.com/api/v1/catalog/1.0.0/search"
        }else{
          url = "https://services-gcp.sentinel-hub.com/api/v1/catalog/1.0.0/search"
        }*/

        const CatalogResponse = await fetch(
          "https://services-uswest2.sentinel-hub.com/api/v1/catalog/1.0.0/search",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(json),
          }
        );

        if (!CatalogResponse.ok) {
          throw new Error(`Failed to fetch catalog, status: ${CatalogResponse.status}`);
        }

        // Set headers to tell the client the content type is an image in TIFF format
        res.writeHead(200, {
        "Content-Type": CatalogResponse.headers.get("content-type"),
        "Content-Disposition": "inline",
        });      
        
        // Pipe the image response directly to the client
        CatalogResponse.body.pipe(res);
      } catch (error) {
        console.error("Error fetching image:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to fetch image" }));
      }
    });
  }
  
  else if (req.url == "/get-image" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
      
    });
    req.on("end", async () => {
      try {
        const token = await getToken();

        var jsonIm = JSON.parse(body)
        var urlIm;

        var jsonIm = JSON.parse(body)
        var urlIm;


        if ("implementation" in jsonIm){
          var implementationIm = jsonIm.implementation
          delete jsonIm.implementation
          if (implementationIm === "UE"){
            urlIm = "https://services.sentinel-hub.com/api/v1/process"
          }else if(implementationIm === "CREO"){
            urlIm = "https://creodias.sentinel-hub.com/api/v1/process"
          }else if(implementationIm === "US-WEST"){
            urlIm = "https://services-uswest2.sentinel-hub.com/api/v1/process"  
          }else{
            urlIm = "https://services-gcp.sentinel-hub.com/api/v1/process"
          }
        }else{
          urlIm = "https://services.sentinel-hub.com/api/v1/process"
        }
        
        const imageResponse = await fetch(
          urlIm,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(jsonIm),
          }
        );

        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image, status: ${imageResponse.status}`);
        }

        // Set headers to tell the client the content type is an image in TIFF format
        res.writeHead(200, {
        "Content-Type": imageResponse.headers.get("content-type"),
        "Content-Disposition": "inline",
        });      
        
        // Pipe the image response directly to the client
        imageResponse.body.pipe(res);
      } catch (error) {
        console.error("Error fetching image:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to fetch image" }));
      }
    });
  }
  // Routes to fetch informatiom from Planet
  else if (req.url === "/get-analytics-subscriptions" && req.method === "GET") {
    try {
      const planetResponse = await fetch(
        "https://api.planet.com/analytics/subscriptions/",
        {
          headers: {
            Authorization: `api-key ${PL_API_KEY}`,
          },
        }
      );

      if (!planetResponse.ok) {
        throw new Error(
          `Failed to fetch data from Planet API: ${planetResponse.statusText}`
        );
      }

      const planetData = await planetResponse.json();
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(planetData));
    } catch (error) {
      console.error("Error fetching Planet API data:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to fetch Planet API data" }));
    }
  } else if (
    req.url.startsWith("/get-analytics-progress") &&
    req.method === "GET"
  ) {
    const queryObject = parse(req.url, true).query;
    const request_id = queryObject.request_id;

    if (!request_id) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing request_id parameter" }));
      return;
    }

    const progressData = analyticsProgressStore.get(request_id);

    if (!progressData) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Progress not found" }));
      return;
    }

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(progressData));
  } else if (
    req.url.startsWith("/get-analytics-results") &&
    req.method === "GET"
  ) {
    // Parse the request URL
    const queryObject = parse(req.url, true).query;

    // Extract the subscription_id from the query parameters
    const subscription_id = queryObject.subscription_id;
    const request_id = queryObject.request_id;

    if (!subscription_id || !request_id) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ error: "Missing subscription_id or request_id parameter" })
      );
      return;
    }

    analyticsProgressStore.set(request_id, {
      status: "running",
      pagesProcessed: 0,
      featuresProcessed: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    try {
      // Keep page size conservative so pagination links are returned consistently.
      let nextUrl = `https://api.planet.com/analytics/collections/${subscription_id}/items?limit=${ANALYTICS_ITEMS_PAGE_LIMIT}`;
      const features = [];
      let firstPageData = null;
      let pagesProcessed = 0;

      while (nextUrl) {
        const planetResponse = await fetchPlanetAnalyticsPage(nextUrl);

        const pageData = await planetResponse.json();

        if (!firstPageData) {
          firstPageData = pageData;
        }

        if (Array.isArray(pageData.features)) {
          features.push(...pageData.features);
        }
        pagesProcessed += 1;

        analyticsProgressStore.set(request_id, {
          status: "running",
          pagesProcessed,
          featuresProcessed: features.length,
          startedAt:
            analyticsProgressStore.get(request_id)?.startedAt ||
            new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        nextUrl = getAnalyticsNextLink(pageData);
      }

      const planetData = {
        ...(firstPageData || {}),
        features,
      };

      analyticsProgressStore.set(request_id, {
        status: "completed",
        pagesProcessed,
        featuresProcessed: features.length,
        startedAt:
          analyticsProgressStore.get(request_id)?.startedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(planetData));
    } catch (error) {
      console.error("Error fetching Planet API data:", error);
      analyticsProgressStore.set(request_id, {
        ...(analyticsProgressStore.get(request_id) || {}),
        status: "error",
        error: String(error),
        updatedAt: new Date().toISOString(),
      });
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to fetch Planet API data" }));
    }
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
