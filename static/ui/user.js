async function createToken() {
    let tokenName = document.querySelector("#token_name").value;
    if(tokenName == "")
        tokenName = "DEFAULT";
    let response = await fetch(TOKEN_PATH, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
            name: tokenName
        })
    });
    if(response.status == 200)
        window.location.reload();
}

async function deleteToken(id) {
    let response = await fetch(TOKEN_PATH, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            id: id
        })
    });
    if(response.status == 200)
        window.location.reload();
}

async function deleteFile(id) {
    let response = await fetch(FILE_PATH, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            id: id
        })
    });
    if(response.status == 200)
        window.location.reload();
}
