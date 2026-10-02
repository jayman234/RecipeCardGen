// -----------------------------------
// GET ELEMENTS FROM THE PAGE
// -----------------------------------

const recipeUrlInput = document.getElementById("recipe-url");

const imageSelection = document.getElementById("image-selection");
const previewImage = document.getElementById("preview-image");
const previewQR = document.getElementById("preview-qr");


const imageUrlInput = document.getElementById("image-url");
const imageFileInput = document.getElementById("image-file");

const findImagesButton = document.getElementById("find-images");
const imageResults = document.getElementById("image-results");

// Currently selected image
let selectedImageURL = null;

// -----------------------------------
// RECIPE URL
// -----------------------------------

let recipeURLTimer;

recipeUrlInput.addEventListener("input", function () {

    clearTimeout(recipeURLTimer);

    recipeURLTimer = setTimeout(function () {

        const url = recipeUrlInput.value.trim();


        // Nothing entered

        if (url === "") {

            previewQR.innerHTML = "QR Code";

            return;
        }


        // Check URL

        try {

            new URL(url);

        }

        catch {

            previewQR.innerHTML = "Invalid URL";

            return;
        }


        // Valid URL
        // Generate QR code

        previewQR.innerHTML = "";

        new QRCode(previewQR, {
            text: url,
            width: 250,
            height: 250,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });

    }, 500);

});


// -----------------------------------
// IMAGE URL
// -----------------------------------

imageUrlInput.addEventListener("input", function () {

    const imageURL = imageUrlInput.value.trim();

    // Nothing entered
    if (imageURL === "") {
        return;
    }

    // Save image URL
    selectedImageURL = imageURL;

    // Show image in selection area
    imageSelection.innerHTML =
        "<img src=\"" + imageURL + "\" alt=\"Selected recipe image\">";

    // Show image in card preview
    previewImage.innerHTML =
        "<img src=\"" + imageURL + "\" alt=\"Recipe preview\">";

});


// -----------------------------------
// IMAGE UPLOAD
// -----------------------------------

imageFileInput.addEventListener("change", function () {

    const file = imageFileInput.files[0];

    // No file selected
    if (!file) {
        return;
    }

    // Create temporary URL for the uploaded image
    const imageURL = URL.createObjectURL(file);

    // Save image URL
    selectedImageURL = imageURL;

    // Show image in selection area
    imageSelection.innerHTML =
        "<img src=\"" + imageURL + "\" alt=\"Selected recipe image\">";

    // Show image in card preview
    previewImage.innerHTML =
        "<img src=\"" + imageURL + "\" alt=\"Recipe preview\">";

});

// -----------------------------------
// FIND IMAGES FROM RECIPE
// -----------------------------------

findImagesButton.addEventListener("click", async function () {

    const recipeURL = recipeUrlInput.value.trim();

    // Check that a recipe URL has been entered
    if (recipeURL === "") {

        alert("Please enter a recipe URL first.");

        return;
    }

    // Check that the URL is valid
    try {

        new URL(recipeURL);

    }

    catch {

        alert("Please enter a valid recipe URL.");

        return;
    }

    // Show loading message
    imageResults.innerHTML =
        "<p>Finding images...</p>";

    try {

        // Call Azure Function
        const response = await fetch(
            "/api/find-images?url=" +
            encodeURIComponent(recipeURL)
        );

        // Check for server error
        if (!response.ok) {

            throw new Error("Image finder request failed.");

        }

        const data = await response.json();

        // Clear results
        imageResults.innerHTML = "";

        // Check whether images were found
        if (!data.images || data.images.length === 0) {

            imageResults.innerHTML =
                "<p>No images were found on this recipe page.</p>";

            return;
        }

        // Create image result for each image
        data.images.forEach(function (imageURL) {

            const imageResult =
                document.createElement("div");

            imageResult.className = "image-result";

            const image =
                document.createElement("img");

            image.src = imageURL;

            image.alt = "Recipe image";

            // -----------------------------------
            // IMAGE SELECTED
            // -----------------------------------

            imageResult.addEventListener(
                "click",
                function () {

                    // Remove selected state
                    const allResults =
                        document.querySelectorAll(".image-result");

                    allResults.forEach(function (result) {

                        result.classList.remove("selected");

                    });

                    // Select this image
                    imageResult.classList.add("selected");

                    // Save image URL
                    selectedImageURL = imageURL;

                    // Show selected image
                    imageSelection.innerHTML =
                        "<img src=\"" +
                        imageURL +
                        "\" alt=\"Selected recipe image\">";

                    // Show image in card preview
                    previewImage.innerHTML =
                        "<img src=\"" +
                        imageURL +
                        "\" alt=\"Recipe preview\">";

                }
            );

            // Add image to result
            imageResult.appendChild(image);

            imageResults.appendChild(imageResult);

        });

    }

    catch (error) {

        console.error(error);

        imageResults.innerHTML =
            "<p>Unable to find images from this recipe.</p>";

    }

});

// -----------------------------------
// DOWNLOAD PDF
// -----------------------------------

const downloadPDFButton = document.getElementById("download-pdf");

downloadPDFButton.addEventListener("click", function () {

    // Check that an image has been selected

    if (selectedImageURL === null) {

        alert("Please select an image first.");

        return;
    }


    // Check that a recipe URL has been entered

    const recipeURL = recipeUrlInput.value.trim();

    if (recipeURL === "") {

        alert("Please enter a recipe URL first.");

        return;
    }


    // Create the PDF

    createPDF(recipeURL, selectedImageURL);

});

// -----------------------------------
// CREATE PDF
// -----------------------------------

function createPDF(recipeURL, imageURL) {

    const { jsPDF } = window.jspdf;


    // Create an A4 portrait PDF
    // Units are millimetres

    const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });


    // -----------------------------------
    // CARD POSITION
    // -----------------------------------

    const cardX = 10;
    const cardY = 10;


    // -----------------------------------
    // CARD SIZE
    // -----------------------------------

    const imageSize = 50;
    const qrSize = 50;


    // -----------------------------------
    // LOAD IMAGE
    // -----------------------------------

    const image = new Image();

    image.onload = function () {

        // Create a square canvas for cropping

        const canvas = document.createElement("canvas");

        canvas.width = 1000;
        canvas.height = 1000;

        const context = canvas.getContext("2d");


        // -----------------------------------
        // CROP IMAGE TO SQUARE
        // -----------------------------------

        const sourceWidth = image.naturalWidth;
        const sourceHeight = image.naturalHeight;

        const sourceSize = Math.min(
            sourceWidth,
            sourceHeight
        );

        const sourceX =
            (sourceWidth - sourceSize) / 2;

        const sourceY =
            (sourceHeight - sourceSize) / 2;


        context.drawImage(
            image,

            sourceX,
            sourceY,
            sourceSize,
            sourceSize,

            0,
            0,
            1000,
            1000
        );


        // Convert cropped image to PNG

        const croppedImage =
            canvas.toDataURL("image/png");


        // -----------------------------------
        // ADD IMAGE TO PDF
        // -----------------------------------

        pdf.addImage(
            croppedImage,
            "PNG",
            cardX,
            cardY,
            imageSize,
            imageSize
        );


        // -----------------------------------
        // GET QR CODE
        // -----------------------------------

        const qrCanvas =
            previewQR.querySelector("canvas");


        if (!qrCanvas) {

            alert("QR code has not been generated yet.");

            return;
        }


        const qrImage =
            qrCanvas.toDataURL("image/png");


        // -----------------------------------
        // ADD QR TO PDF
        // -----------------------------------

        pdf.addImage(
            qrImage,
            "PNG",
            cardX + imageSize,
            cardY,
            qrSize,
            qrSize
        );


        // -----------------------------------
        // DOWNLOAD
        // -----------------------------------

        pdf.save("recipe-card.pdf");

    };


    // Tell the browser this is a cross-origin image

    image.crossOrigin = "Anonymous";

    image.src = imageURL;

}