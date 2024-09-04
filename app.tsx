import React, { useState, useRef, useEffect } from "react";
import { Button, Rows, Text, FormField, Select, MultilineInput, Box, ProgressBar, Title, Avatar, Slider, Swatch } from "@canva/app-ui-kit";
import type { TextAttributes, SelectionEvent } from "@canva/design";
import { setCurrentPageBackground, initAppElement } from "@canva/design";
import { useSelection } from "utils/use_selection_hook";
import { getTemporaryUrl, upload, openColorSelector, Anchor, ColorSelectionEvent, ColorSelectionScope } from "@canva/asset";
import styles from "styles/components.css";
import imageProcessor from './imageProcessor';
import { appProcess } from "@canva/platform";
import generateImagePanel from './generateImagePanel';

type AppElementData = {
  action: TextAttributes["action"];
  shape: TextAttributes["shape"];
  userPrompt: TextAttributes["userPrompt"];
  fontFamily: TextAttributes["fontFamily"];
  userText: TextAttributes["userText"];
  imageId: string;
};

type UIState = AppElementData & {
  letterSpacing: number;
  lineSpacing: number;
  textEffect: string;
  borderColor: string;
};

const abort = () => appProcess.current.requestClose({ reason: "aborted" });

const initialState: UIState = {
  action: "Change Image Background",
  shape: "",
  userPrompt: "",
  fontFamily: "Arial",
  userText: "",
  imageId: "",
  letterSpacing: 0,
  lineSpacing: 1,
  textEffect: "noBorder",
  borderColor: "#000000",
};

const appElementClient = initAppElement<AppElementData>({
  render: (data) => {
    return [
      {
        type: "IMAGE",
        top: 0,
        left: 0,
        ref: data.imageId, // Reference the imageId stored in the state
        width: 400,
        height: 400,
        rotation: 0,
      },
    ];
  },
});

export const App = () => {
  const [state, setState] = useState<UIState>(initialState);
  const { shape, action, userPrompt, userText, fontFamily, imageId, letterSpacing, lineSpacing, textEffect, borderColor } = state;

  const [loading, setLoading] = useState(false);
  const [buttonEnabled, setButtonEnabled] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalIdRef = useRef<NodeJS.Timer>();

  const selection = useSelection("image");

  let startTime: number;

  // Color picker logic
  const onColorSelect = async <T extends ColorSelectionScope>(e: ColorSelectionEvent<T>) => {
    if (e.selection.type === "solid") {
      setState((prevState) => ({
        ...prevState,
        borderColor: e.selection.hexString,
      }));
    }
  };

  const onRequestOpenColorSelector = (boundingRect: Anchor) => {
    openColorSelector(boundingRect, {
      onColorSelect,
      scopes: ["solid"],
    });
  };

  // Download the selected images
  const loadOriginalImage = async (selection: SelectionEvent<"image">) => {
    if (selection.count !== 1) {
      return null;
    }
    const draft = await selection.read();
    const { url } = await getTemporaryUrl({
      type: "IMAGE",
      ref: draft.contents[0].ref,
    });
    return url;
  };

  const performAction = async () => {
    startTime = Date.now();
    console.log(`Action ${action} started at ${new Date(startTime).toLocaleTimeString()}`);

    setLoading(true);
    setProgress(0);
    startProgressBar();

    // Handle image processing
    if (action === "generate shaped image" || action === "generate transparent shape" || action === "text frame") {
      const imageGeneratedUrl = await imageProcessor(action, userPrompt, null, shape, userText, fontFamily, textEffect, letterSpacing, lineSpacing, borderColor);
      console.log(`AI generated URL - app: ${action}`, imageGeneratedUrl);

      if (imageGeneratedUrl) {
        // Upload the processed image and add or update the app element
        const { ref: imageRef } = await upload({
          type: "IMAGE",
          url: imageGeneratedUrl,
          mimeType: "image/png",
          thumbnailUrl: imageGeneratedUrl,
        });

        // Update the app element to include the generated image
        await appElementClient.addOrUpdateElement({
          ...state,
          imageId: imageRef,
        });
      }

      stopProgressBar();
      logEndTime();
    }

    // Download the image if required by action
    let selectedImageUrl = null;
    if (action === "change background" || action === "add picture frame" || action === "add border" || action === "add shaped frame" || action === "image variation") {
      if (selection.count === 1) {
        selectedImageUrl = await loadOriginalImage(selection);

        console.log('Canva Selected Temporary URL: ', selectedImageUrl);
      }

      const imageGeneratedUrl = await imageProcessor(action, userPrompt, selectedImageUrl, shape, null, null, null, null, null, null);
      console.log(`AI generated URL - app: ${action}`, imageGeneratedUrl);

      if (imageGeneratedUrl) { // this is the AI generated URL
        const { ref: imageRef } = await upload({
          type: "IMAGE",
          url: imageGeneratedUrl,
          mimeType: "image/png",
          thumbnailUrl: imageGeneratedUrl,
        });

        const draft = await selection.read();
        draft.contents.forEach((s) => (s.ref = imageRef));
        await draft.save();
      }
    }

    if (action === "generate background") {
      const imageGeneratedUrl = await imageProcessor(action, userPrompt, null, null, null, null, null, null, null, null);
      console.log(`AI generated URL - app: ${action}`, imageGeneratedUrl);

      const { ref } = await upload({
        type: "IMAGE",
        mimeType: "image/png",
        url: imageGeneratedUrl,
        thumbnailUrl: imageGeneratedUrl,
        width: 540,
        height: 720,
      });

      await setCurrentPageBackground({
        asset: { type: "IMAGE", ref },
      });
    }

    if (action === "3D image panel") {


      const imageGeneratedUrl = await generateImagePanel(action, userPrompt);
      console.log(`Generated 3D Image Panel URL: ${imageGeneratedUrl}`);

      if (imageGeneratedUrl) {
        // Upload the processed image and add or update the app element
        const { ref: imageRef } = await upload({
          type: "IMAGE",
          url: imageGeneratedUrl,
          mimeType: "image/png",
          thumbnailUrl: imageGeneratedUrl,
        });

        // Update the app element to include the generated image
        await appElementClient.addOrUpdateElement({
          ...state,
          imageId: imageRef,
        });
      }

      stopProgressBar();
      logEndTime();

    }

    stopProgressBar();
    logEndTime();
  };

  const logEndTime = () => {
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    console.log(`Action ${action} finished at ${new Date(endTime).toLocaleTimeString()} and took ${duration} seconds`);
  };

  const startProgressBar = () => {
    const ESTIMATED_TIME_TO_COMPLETE_IN_MS = 5 * 1_000;
    const INTERVAL_DURATION_IN_MS = 100;
    const TOTAL_PROGRESS_PERCENTAGE = 100;
    const totalNumberOfProgressBarUpdates = Math.ceil(ESTIMATED_TIME_TO_COMPLETE_IN_MS / INTERVAL_DURATION_IN_MS);
    let updateCount = 1;

    intervalIdRef.current = setInterval(() => {
      if (updateCount > totalNumberOfProgressBarUpdates) {
        clearInterval(intervalIdRef.current);
        return;
      }
      setProgress(prevProgress => {
        const nextProgressValue = prevProgress + Math.ceil(TOTAL_PROGRESS_PERCENTAGE / totalNumberOfProgressBarUpdates);
        return Math.min(nextProgressValue, TOTAL_PROGRESS_PERCENTAGE);
      });
      updateCount += 1;
    }, INTERVAL_DURATION_IN_MS);
  };

  const stopProgressBar = () => {
    clearInterval(intervalIdRef.current);
    setLoading(false);
    setProgress(0);
  };

  // Effect to validate and enable the button
  useEffect(() => {
    const shouldEnableButton = () => {
      if (action === "generate background" || action === "3D image panel") {
        return userPrompt.trim() !== "";
      }
      if (action === "generate shaped image" || action === "add shaped frame" || action === "generate transparent shape") {
        return shape !== "none" && userPrompt.trim() !== "";
      }
      if (action === "text frame") {
        return action !== "none" && fontFamily !== "none" && userText.trim() !== "" && userPrompt.trim() !== "";
      }
      if (action === "image variation" && selection.count === 1) {
        return action === "image variation" && selection.count === 1;
      }
      if (action === "change background" && selection.count === 1) {
        return action === "change background" && selection.count === 1 && userPrompt.trim() !== "";
      }
      if (action === "add picture frame" && selection.count === 1) {
        return action === "add picture frame" && selection.count === 1 && userPrompt.trim() !== "";
      }
      if (action === "add border" && selection.count === 1) {
        return action === "add border" && selection.count === 1 && userPrompt.trim() !== "";
      }
      if (action === "add shaped frame" && selection.count === 1) {
        return action === "add shaped frame" && selection.count === 1 && userPrompt.trim() !== "";
      }
    };

    setButtonEnabled(shouldEnableButton());
  }, [action, userPrompt, shape, userText, fontFamily, textEffect, letterSpacing, lineSpacing, borderColor, selection.count]);

  return (
    <div className={styles.scrollContainer}>
      <Rows spacing="1u">
        <center>
          <Avatar
            buttonAriaLabel="Art Tricks Wizard"
            name="Art Tricks Wizard"
            photo="https://hackthons-eimis-pacheco-2024.s3.amazonaws.com/artTricksWizard.png"
          />
        </center>

        <Box>
          <Title size="xsmall">
            Enchant Your Designs with AI
          </Title>
          <div id="initial-options" style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            padding: '1px',
            borderTop: '1px solid #ddd',
            justifyContent: 'center',
            background: 'linear-gradient(90deg, #3dc0cd, #7335e6)',
          }} />
        </Box>
      </Rows>
      <br />
      {loading ? (
        <Box className={styles.fullHeight} display="flex" alignItems="center">
          <Rows spacing="3u">
            <Rows spacing="2u">
              <Title alignment="center" size="small">
                Magic in Progress
              </Title>
              <ProgressBar value={progress} ariaLabel={"loading progress bar"} />
              <Text alignment="center" tone="tertiary" size="small">
                Please wait while the magic happens
              </Text>
            </Rows>
          </Rows>
        </Box>
      ) : (
        <Rows spacing="2u">
          <Text>
            Select an action from the list:
          </Text>

          <FormField
            label="Actions"
            value={action}
            description=""
            control={(props) => (
              <Select<TextAttributes["action"]>
                {...props}
                options={[
                  { value: "change background", label: "Change Image Background" },
                  { value: "add picture frame", label: "Add Picture Frame" },
                  { value: "add border", label: "Add Border" },
                  { value: "add shaped frame", label: "Add Shaped Frame" },
                  { value: "3D image panel", label: "3D Image Panel" }, 
                  { value: "generate transparent shape", label: "Generate Transparent Shape" },
                  { value: "generate shaped image", label: "Generate shaped Image" },
                  { value: "text frame", label: "Text Frame" },
                  { value: "image variation", label: "Image Variation" },
                  { value: "generate background", label: "Generate Background" }
                ]}
                onChange={(value) => {
                  setState((prevState) => ({
                    ...prevState,
                    action: value,
                  }));
                }}
              />
            )}
          />

          {action === "text frame" && (
            <>
              <FormField
                label="Input Text"
                value={userText}
                description=""
                control={(props) => (
                  <MultilineInput<TextAttributes["userText"]>
                    {...props}
                    onChange={(value) => {
                      setState((prevState) => ({
                        ...prevState,
                        userText: value,
                      }));
                    }}
                  />
                )}
              />

              <FormField
                label="Font Family"
                value={fontFamily}
                description="Select your preferred font family for the design"
                control={(props) => (
                  <Select<TextAttributes["fontFamily"]>
                    {...props}
                    options={[
                      { value: "Arial", label: "Arial" },
                      { value: "Helvetica", label: "Helvetica" },
                      { value: "Times New Roman", label: "Times New Roman" },
                      { value: "Courier New", label: "Courier New" },
                      { value: "Verdana", label: "Verdana" },
                      { value: "Georgia", label: "Georgia" },
                      { value: "Palatino", label: "Palatino" },
                      { value: "Garamond", label: "Garamond" },
                      { value: "Comic Sans MS", label: "Comic Sans MS" },
                      { value: "Trebuchet MS", label: "Trebuchet MS" },
                      { value: "Arial Black", label: "Arial Black" },
                      { value: "Impact", label: "Impact" },
                    ]}
                    placeholder="Arial"
                    onChange={(value) => {
                      setState((prevState) => ({
                        ...prevState,
                        fontFamily: value,
                      }));
                    }}
                  />
                )}
              />

              <FormField
                label="Text Effect"
                value={textEffect}
                description="Select your preferred text effect for the design"
                control={(props) => (
                  <Select<TextAttributes["textEffect"]>
                    {...props}
                    options={[
                      { value: "noBorder", label: "No Border" },
                      { value: "borderFlag", label: "With Border" },
                      { value: "dddFlag1", label: "3D V1" },
                      { value: "dddFlag2", label: "3D V2" },
                      { value: "haloFlag", label: "Halo" },
                      { value: "transparentFlag", label: "Transparent Letters" }
                    ]}
                    placeholder="No Border"
                    onChange={(value) => {
                      setState((prevState) => ({
                        ...prevState,
                        textEffect: value,
                      }));
                    }}
                  />
                )}
              />

              {textEffect !== "noBorder" && textEffect !== "haloFlag" && textEffect !== "transparentFlag"  && (
                <FormField
                  label="Border Color"
                  value={borderColor}
                  description="Select the color for your border"
                  control={() => (
                    <Swatch
                      fill={[borderColor]}
                      onClick={(e) =>
                        onRequestOpenColorSelector(e.currentTarget.getBoundingClientRect())
                      }
                    />
                  )}
                />
              )}
            </>
          )}

          {(action === "generate shaped image" || action === "add shaped frame" || action === "generate transparent shape") && (
            <FormField
              label="Shapes"
              value={shape}
              description=""
              control={(props) => (
                <Select<TextAttributes["shape"]>
                  {...props}
                  options={[
                    { value: "heart", label: "Heart" },
                    { value: "circle", label: "Circle" },
                    { value: "triangle", label: "Triangle" },
                    { value: "cross", label: "Cross" },
                    { value: "star", label: "Star" },
                    { value: "pentagon", label: "Pentagon" },
                    { value: "octagon", label: "Octagon" },
                    { value: "decaton", label: "Decaton" },
                    { value: "rhombus", label: "Rhombus" }
                  ]}
                  onChange={(value) => {
                    setState((prevState) => ({
                      ...prevState,
                      shape: value,
                    }));
                  }}
                />
              )}
            />
          )}

          <FormField
            label="Designer Prompt"
            value={userPrompt}
            description=""
            control={(props) => (
              <MultilineInput<TextAttributes["userPrompt"]>
                {...props}
                onChange={(value) => {
                  setState((prevState) => ({
                    ...prevState,
                    userPrompt: value,
                  }));
                }}
                disabled={action === "image variation"} 
              />
            )}
          />

          {action === "text frame" && (
            <>
              <Text tone="tertiary" size="small">
                Letter Spacing
              </Text>
              <Box paddingStart="2u">
                <Slider
                  defaultValue={letterSpacing}
                  max={80}
                  min={0}
                  step={5}
                  onChange={(value) => setState((prevState) => ({
                    ...prevState,
                    letterSpacing: value,
                  }))}
                />
              </Box>

              <Text tone="tertiary" size="small">
                Line Spacing
              </Text>
              <Box paddingStart="2u">
                <Slider
                  defaultValue={lineSpacing}
                  max={1.5}
                  min={1}
                  step={0.05}
                  onChange={(value) => setState((prevState) => ({
                    ...prevState,
                    lineSpacing: value,
                  }))}
                />
              </Box>
            </>
          )}

          <Button
            variant="primary"
            onClick={performAction}
            disabled={!buttonEnabled}
            loading={loading}
          >
            Perform the magic trick
          </Button>
        </Rows>
      )}
    </div>
  );
};
