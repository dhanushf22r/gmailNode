const CLIENT_ID = "251974022404-5loc0451c8q7q6hh2pds8i50lan6h0s6.apps.googleusercontent.com";
const API_KEY = "AIzaSyD0a5-egT1IDNaoYljATmUUiPqPVFUwk7Q";

// Discovery doc URL for APIs used by the quickstart
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest";

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = "https://www.googleapis.com/auth/gmail.readonly";

let tokenClient;
let gapiInited = false;
let gisInited = false;

// Initially hide the input container
document.getElementById("search_input_container").style.display = "none";
document.getElementById("signout_button").style.visibility = "hidden";

/**
 * Callback after api.js is loaded.
 */
function gapiLoaded() {
  gapi.load("client", initializeGapiClient);
}

/**
 * Callback after the API client is loaded. Loads the
 * discovery doc to initialize the API.
 */
async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: API_KEY,
    discoveryDocs: [DISCOVERY_DOC],
  });
  gapiInited = true;
  maybeEnableButtons();
}

/**
 * Callback after Google Identity Services are loaded.
 */
function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: "", // defined later
  });
  gisInited = true;
  maybeEnableButtons();
}

/**
 * Enables user interaction after all libraries are loaded.
 */
function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    document.getElementById("authorize_button").style.visibility = "visible";
  }
}

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick() {
  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) {
      throw resp;
    }
    document.getElementById("signout_button").style.visibility = "visible";
    document.getElementById("search_input_container").style.display = "block"; // Show the input container
    document.getElementById("authorize_button").innerText = "Refresh";
    await listLabels();
  };

  if (gapi.client.getToken() === null) {
    // Prompt the user to select a Google Account and ask for consent to share their data
    // when establishing a new session.
    tokenClient.requestAccessToken({ prompt: "consent" });
  } else {
    // Skip display of account chooser and consent dialog for an existing session.
    tokenClient.requestAccessToken({ prompt: "" });
  }
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick() {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken("");
    document.getElementById("content").innerText = "";
    document.getElementById("search_results").innerText = ""; // Clear search results
    document.getElementById("authorize_button").innerText = "Authorize";
    document.getElementById("signout_button").style.visibility = "hidden";
    document.getElementById("search_input_container").style.display = "none"; // Hide the input container
  }
}

/**
 * Print all Labels in the authorized user's inbox. If no labels
 * are found an appropriate message is printed.
 */
async function searchForEmails(service, user_id, search_query) {
  const results = await gapi.client.gmail.users.messages.list({
    userId: user_id,
    q: search_query,
  });

  const messages = results.result.messages || [];
  return messages;
}

async function getEmailDetails(service, user_id, message_id) {
  const message = await gapi.client.gmail.users.messages.get({
    userId: user_id,
    id: message_id,
  });

  const headers = message.result.payload.headers;
  const fromHeader = headers.find(header => header.name === 'From');
  const timeSent = new Date(parseInt(message.result.internalDate)).toLocaleDateString('en-GB');
  const body = message.result.snippet;

  return {
    from: fromHeader ? fromHeader.value : 'Unknown',
    timeSent: timeSent,
    body: body,
  };
}

function extractLinks(text) {
  const linkPattern = /http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g;
  const links = text.match(linkPattern) || [];
  return links;
}

async function handleSearchClick() {
  const searchQuery = document.getElementById("search_input").value.trim();
  if (searchQuery !== "") {
    // Clear previous search results
    document.getElementById("search_results").innerHTML = "";

    const user_id = "me";
    const messages = await searchForEmails(gapi.client.gmail.users.messages, user_id, searchQuery);

    if (messages.length === 0) {
      document.getElementById("search_results").innerText = "No emails found.";
      return;
    }

    const searchResultsElement = document.getElementById("search_results");

    for (const message of messages) {
      const messageDetails = await getEmailDetails(gapi.client.gmail.users.messages, user_id, message.id);
      const emailContent = `
        <div>
          <p><strong>From:</strong> ${messageDetails.from}</p>
          <p><strong>Time sent:</strong> ${messageDetails.timeSent}</p>
          <p><strong>Links in the mail:</strong></p>
          <ul>
            ${extractLinks(messageDetails.body)
              .map(link => `<li><a href="${link}" target="_blank">${link}</a></li>`)
              .join("")}
          </ul>
        </div>
      `;

      const emailDiv = document.createElement("div");
      emailDiv.innerHTML = emailContent;

      searchResultsElement.appendChild(emailDiv);
    }
  }
}
