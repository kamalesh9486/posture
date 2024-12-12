export const pushToCouchDB = async (data) => {
  const dbName = "yoga_keypoints";
  const dbURL = `http://localhost:5984/${dbName}`;
  const username = "admin";
  const password = "admin";

  try {
    // First, check if the database exists
    const checkResponse = await fetch(dbURL, {
      method: "HEAD",
      headers: {
        Authorization: `Basic ${btoa(username + ":" + password)}`,
      },
    });

    // If database doesn't exist, create it
    if (checkResponse.status === 404) {
      const createResponse = await fetch(dbURL, {
        method: "PUT",
        headers: {
          Authorization: `Basic ${btoa(username + ":" + password)}`,
        },
      });

      if (!createResponse.ok) {
        console.error("Failed to create database:", await createResponse.text());
        return;
      }
      console.log("Database created successfully");
    }

    // Push data to the database
    const response = await fetch(dbURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(username + ":" + password)}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.error("Failed to push data to CouchDB:", await response.text());
    } else {
      console.log("Data successfully pushed to CouchDB:", await response.json());
    }
  } catch (error) {
    console.error("Error in CouchDB operation:", error);
  }
};