import { id } from './id';
import ToolNames from '@ohif/extension-cornerstone-dicom-sr/src/tools/toolNames';
import { initDCEService } from './services/DCEService';
import DCEPlotPanel from './components/DCEPlotPanel';
import { Button } from '@ohif/ui';
import { ToolButtonWrapper } from '@ohif/extension-default/src/Toolbar';
import i18n from 'i18next';
import { SegmentationRepresentations } from '@cornerstonejs/tools/enums';
import { BaseVolumeViewport, getEnabledElement } from '@cornerstonejs/core';
import { segmentation, annotation, drawing } from '@cornerstonejs/tools';
import { computeTtpWr } from './utils/ttpWrMath';
import { DicomMetadataStore } from '@ohif/core/src/services/DicomMetadataStore';
import { getCurrentVolumeViewportSlice } from '@cornerstonejs/core/utilities';
import {
  Enums,
  utilities,
  cache,
  getRenderingEngines,
  getRenderingEngine,
  imageLoader,
  volumeLoader,
} from '@cornerstonejs/core';
// import { getPixelData } from '@cornerstonejs/tools/annotation/utilities'
const { transformWorldToIndex } = utilities;
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import { triggerSegmentationDataModified } from '@cornerstonejs/tools/segmentation/events/triggerSegmentationDataModified';
import { servicesManager } from '@ohif/app/src/App';

/**
 * You can remove any of the following modules if you don't need them.
 */
export default {
  /**
   * Only required property. Should be a unique value across all extensions.
   * You ID can be anything you want, but it should be unique.
   */
  id,

  /**
   * Perform any pre-registration tasks here. This is called before the extension
   * is registered. Usually we run tasks such as: configuring the libraries
   * (e.g. cornerstone, cornerstoneTools, ...) or registering any services that
   * this extension is providing.
   */
  preRegistration: ({ servicesManager, commandsManager, configuration = {} }) => {
    // initDCEService(servicesManager, commandsManager);
    // NEW: Create service to store DCE parameters
    const dceParamsService = {
      startFrame: 8,
      kernelSize: 4,
      setStartFrame(value) {
        this.startFrame = value;
      },
      setKernelSize(value) {
        this.kernelSize = value;
      },
      getStartFrame() {
        return this.startFrame;
      },
      getKernelSize() {
        return this.kernelSize;
      },
    };


    servicesManager.registerService({
      name: 'dceParamsService',
      create: ({ configuration = {} }) => {
        return dceParamsService;
      },
    });

    // servicesManager.registerService('dceParamsService', dceParamsService);
  },
  /**
   * PanelModule should provide a list of panels that will be available in OHIF
   * for Modes to consume and render. Each panel is defined by a {name,
   * iconName, iconLabel, label, component} object. Example of a panel module
   * is the StudyBrowserPanel that is provided by the default extension in OHIF.
   */
  getPanelModule: ({ servicesManager, commandsManager, extensionManager }) => {
    // const wrappedPanel = () => {
    //   return <DCEPlotPanel />;
    // };

    return [
      {
        name: 'DCE_PANEL',
        iconName: 'tool-measure-ellipse',
        iconLabel: 'DCE Panel',
        label: 'DCE Panel',
        // isDisabled: studies => {}, // optional
        component: DCEPlotPanel,
      },
    ];
    // return [
    //   {
    //     name: 'DCE_PANEL',
    //     iconName: 'info-action',
    //     label: 'DCE Panel',
    //     component: DCEPlotPanel,
    //   },
    // ];
  },
  /**
   * ViewportModule should provide a list of viewports that will be available in OHIF
   * for Modes to consume and use in the viewports. Each viewport is defined by
   * {name, component} object. Example of a viewport module is the CornerstoneViewport
   * that is provided by the Cornerstone extension in OHIF.
   */
  getViewportModule: ({ servicesManager, commandsManager, extensionManager }) => {},
  /**
   * ToolbarModule should provide a list of tool buttons that will be available in OHIF
   * for Modes to consume and use in the toolbar. Each tool button is defined by
   * {name, defaultComponent, clickHandler }. Examples include radioGroupIcons and
   * splitButton toolButton that the default extension is providing.
   */
  getToolbarModule: ({ servicesManager, commandsManager, extensionManager }) => {
    return [
      // {
      //   id: 'DCE_TTP_WR',
      //   name: 'DCE_TTP_WR',
      //   defaultComponent: ToolButtonWrapper,
      //   clickHandler: () => {
      //     commandsManager.runCommand('computeTtpWr');
      //   },
      // },
      {
        id: 'DCE_TTP_WR',
        name: 'DCE_TTP_WR',
        component: ToolButtonWrapper,
        uiType: 'ohif.toolButton',
        props: {
          icon: 'tool-capture',
          label: 'Calculate TTP and WR',
          commands: {
            commandName: 'computeTtpWr',
          },
          // evaluate: [
          //   'evaluate.action',
          //   {
          //     name: 'evaluate.viewport.supported',
          //     unsupportedViewportTypes: ['video', 'wholeSlide'],
          //   },
          // ],
        },
        // clickHandler: () => {
        //   commandsManager.runCommand('computeTtpWr');
        // },
      },
      // {
      //   id: 'BrushROI',
      //   name: 'BrushROI',
      //   component: ToolButtonWrapper,
      //   uiType: 'ohif.toolButton',
      //   props: {
      //     icon: 'icon-tool-brush',
      //     label: 'Brush ROI to calculate DCE params',
      //     commands: {
      //       commandName: 'setToolActive',
      //       options: {
      //         toolName: ToolNames.SRCircleROI,
      //       }
      //
      //     },
      // evaluate: [
      //   'evaluate.action',
      //   {
      //     name: 'evaluate.viewport.supported',
      //     unsupportedViewportTypes: ['video', 'wholeSlide'],
      //   },
      // ],
      // },
      // clickHandler: () => {
      //   commandsManager.runCommand('setToolActive', {
      //     toolName: ToolNames.SRCircleROI,
      //   });
      // },
      // },
      // {
      //   name: 'BrushROI',
      //   defaultComponent: {
      //     id: 'BrushROI',
      //     label: 'ROI',
      //     iconName: 'brush',
      //   },
      //   clickHandler: () => {
      //     commandsManager.runCommand('setToolActive', {
      //       toolName: ToolNames.SRCircleROI,
      //     });
      //   },
      // }
    ];
  },
  /**
   * LayoutTemplateMOdule should provide a list of layout templates that will be
   * available in OHIF for Modes to consume and use to layout the viewer.
   * Each layout template is defined by a { name, id, component}. Examples include
   * the default layout template provided by the default extension which renders
   * a Header, left and right sidebars, and a viewport section in the middle
   * of the viewer.
   */
  getLayoutTemplateModule: ({ servicesManager, commandsManager, extensionManager }) => {},
  /**
   * SopClassHandlerModule should provide a list of sop class handlers that will be
   * available in OHIF for Modes to consume and use to create displaySets from Series.
   * Each sop class handler is defined by a { name, sopClassUids, getDisplaySetsFromSeries}.
   * Examples include the default sop class handler provided by the default extension
   */
  getSopClassHandlerModule: ({ servicesManager, commandsManager, extensionManager }) => {},
  /**
   * HangingProtocolModule should provide a list of hanging protocols that will be
   * available in OHIF for Modes to use to decide on the structure of the viewports
   * and also the series that hung in the viewports. Each hanging protocol is defined by
   * { name, protocols}. Examples include the default hanging protocol provided by
   * the default extension that shows 2x2 viewports.
   */
  getHangingProtocolModule: ({ servicesManager, commandsManager, extensionManager }) => {},
  /**
   * CommandsModule should provide a list of commands that will be available in OHIF
   * for Modes to consume and use in the viewports. Each command is defined by
   * an object of { actions, definitions, defaultContext } where actions is an
   * object of functions, definitions is an object of available commands, their
   * options, and defaultContext is the default context for the command to run against.
   */
  getCommandsModule: ({ servicesManager, commandsManager, extensionManager }) => {
    const services = servicesManager.services;
    const { displaySetService, viewportGridService, segmentationService } = services;

    let curve = [];
    let overlay = null;

    const actions = {
      computeTtpWr: () => {
        const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');


        const viewport = renderingEngine.getStackViewport(
          viewportGridService.getActiveViewportId()
        );

        if (!viewport) {
          console.warn('No active viewport found');
          return;
        }

        const currentImageIdx = viewport.getCurrentImageIdIndex();
        const currImgId = viewport.getCurrentImageId(currentImageIdx);

        // if (segmentation.state.getSegmentations().length) {
        //   console.log(
        //     segmentation.getLabelmapImageIdsForImageId(
        //       currImgId,
        //       segmentation.state.getSegmentations()[0]?.segmentationId
        //     )
        //   );
        //   console.log(
        //     cache
        //       .getImage(
        //         segmentation.getLabelmapImageIdsForImageId(
        //           currImgId,
        //           segmentation.state.getSegmentations()[0]?.segmentationId
        //         )[0]
        //       )
        //       ?.getPixelData()
        //   );
        // }

        // const enabledElement = getEnabledElement(viewport.element);
        // const imageIds = viewport.getImageIds();

        // console.log('ALAL');
        // console.log(segmentation.colo);
        // console.log(segmentation.state.getSegmentations());

        // console.log(segmentationService.getLabelmapVolume(segmentation.state.getSegmentations()[0].segmentationId));
        // console.log(cache.getVolume(segmentation.state.getSegmentations()[0].segmentationId));
        // const segmentationObj = segmentation.state.getSegmentations()[0];
        const segmentationObj = null;
        const selectedAnnotationId = annotation.selection.getAnnotationsSelected()[0];
        const annotationObj = annotation.state.getAnnotation(selectedAnnotationId);
        console.log(annotation.state.getAllAnnotations());

        // console.log(segmentationService.getLabelmapVolume(segmentationObj.segmentationId));

        // if (!annotationObj) {
        //   console.warn('Draw ROI first');
        //   return;
        // }

        // if (!annotationObj.data.contour.closed) {
        //   console.warn('Only closed ROIs are supported');
        //   return;
        // }

        // console.log(annotationObj);

        // Get current image dimensions
        // const currentImage = cache.getImage(currImgId);
        // const rows = currentImage.rows;
        // const cols = currentImage.columns;

        // Get canvas dimensions from viewport element
        // const canvasRect = viewport.element.getBoundingClientRect();
        // const canvasWidth = canvasRect.width;
        // const canvasHeight = canvasRect.height;
        //
        // // Convert canvas coordinates → image pixel coordinates
        // const pixelPoints = annotationObj.data.contour.polyline.map(worldPt => {
        //   // World → Canvas coordinates
        //   const canvasPt = viewport.worldToCanvas(worldPt);
        //
        //   // Canvas → Image pixel coordinates (accounting for viewport scaling/offset)
        //   const imgX = Math.round((canvasPt[0] / canvasWidth) * cols);
        //   const imgY = Math.round((canvasPt[1] / canvasHeight) * rows);
        //
        //   // Clamp to image boundaries
        //   return [
        //     Math.max(0, Math.min(cols - 1, imgX)), // i (column)
        //     Math.max(0, Math.min(rows - 1, imgY)), // j (row)
        //   ];
        // });
        //
        // // Ensure polygon is closed
        // if (pixelPoints.length > 2) {
        //   const [firstI, firstJ] = pixelPoints[0];
        //   const [lastI, lastJ] = pixelPoints[pixelPoints.length - 1];
        //   if (firstI !== lastI || firstJ !== lastJ) {
        //     pixelPoints.push([firstI, firstJ]);
        //   }
        // } else {
        //   console.warn('ROI has < 3 valid points');
        //   return;
        // }
        //
        // console.log('Converted pixel points (first 5):', pixelPoints.slice(0, 5));
        // console.log('Image dimensions:', { rows, cols });
        //
        // console.log('Point validation:');
        // pixelPoints.forEach(([i, j], idx) => {
        //   if (i < 0 || i >= cols || j < 0 || j >= rows) {
        //     console.error(`Point ${idx} out of bounds:`, { i, j, cols, rows });
        //   }
        // });
        //
        // const pointsCanvas = [];
        // for (const points of annotationObj.data.contour.polyline) {
        //   pointsCanvas.push(viewport.worldToCanvas(points));
        // }
        // console.log(pointsCanvas);
        // annotationObj['pointsCanvas'] = pointsCanvas;
        // const segmentationId = segmentationObj.segmentationId;

        // const imageIds = segmentationObj.representationData.Labelmap.imageIds;

        // const img = cache.getImage(imageIds[0]);
        // console.log(currImgId);

        const currentInstance = DicomMetadataStore.getInstanceByImageId(currImgId);
        const currentSliceLocation = currentInstance.SliceLocation;
        const currentDisplaySet = displaySetService.getDisplaySetForSOPInstanceUID(
          currentInstance.SOPInstanceUID
        );
        const currentStudy = DicomMetadataStore.getStudy(currentInstance.StudyInstanceUID);

        // Get all display sets in the active study
        const displaySets = displaySetService.getActiveDisplaySets();
        console.log(displaySets);

        const imageIds = [];
        const images = [];
        const imagePromises = [];
        const imagesInfo = displaySets
          .map(displaySet => {
            // const displaySetImageIds = displaySet.images?.map(img => img.imageId)
            //   || displaySet.imageIds;
            const displaySetImageIds = displaySet.imageIds;
            if (!displaySet?.images?.length) {
              console.warn('Display set has no images');
              return;
            }
            let foundImgId = null;
            for (const instanceImg of displaySet.images) {
              // Skip derived or problematic images if needed
              const loadImagePromise = imageLoader
                .loadImage(instanceImg.imageId)
                .then(img => {
                  const instance = DicomMetadataStore.getInstanceByImageId(
                    img.referencedImageId ?? img.imageId
                  );
                  if (instance.SliceLocation == currentSliceLocation) {
                    foundImgId = img.imageId;
                    imageIds.push(img.imageId);
                    images.push(img);
                    return { matched: true, img, instance };
                  }
                  return { matched: false };
                })
                .catch(e => {
                  console.error('Failed to load image:', e);
                  return { matched: false };
                });

              imagePromises.push(loadImagePromise);
            }

            return {
              displaySetUID: displaySet.displaySetInstanceUID,
              seriesUID: displaySet.SeriesInstanceUID,
              imageId: foundImgId,
            };
          })
          .filter(Boolean);

        const dceParamsService = servicesManager.services.dceParamsService;
        Promise.all(imagePromises).then(async () => {
          const { labelmap, rows, cols } = computeTtpWr({
            images,
            startFrame: dceParamsService.getStartFrame(),
            kernelSize: dceParamsService.getKernelSize(),
          });

          // VALIDATE: Critical safety check before proceeding
          if (labelmap.length !== rows * cols) {
            console.error(
              `Labelmap dimension mismatch! Expected ${rows * cols}, got ${labelmap.length}`,
              { rows, cols, actualLength: labelmap.length }
            );
            return;
          }

          segmentation.removeAllSegmentations();

          const segmentationId = 'dce_' + Date.now();
          // CREATE derived labelmap image for CURRENT SLICE only
          const segImage = await imageLoader.createAndCacheDerivedLabelmapImage(currImgId);

          // SET ENTIRE SCALAR DATA (NOT arbitrary indices)
          if (segImage.voxelManager?.setScalarData) {
            // Convert to Uint8Array if needed (labelmap should already be Uint8Array)
            const typedLabelmap =
              labelmap instanceof Uint8Array ? labelmap : new Uint8Array(labelmap);

            segImage.voxelManager.setScalarData(typedLabelmap);
            console.log(`✓ Set labelmap data: ${typedLabelmap.length} voxels (${rows}x${cols})`);
          } else {
            console.error('Derived labelmap image missing voxelManager.setScalarData');
            return;
          }

          // const testIdx = 150 * cols + 200; // row 150, col 200
          // console.log(
          //   'Label at test pixel:',
          //   labelmap[testIdx],
          //   'Voxel value:',
          //   segImage.voxelManager.getAtIndex(testIdx)
          // );

          // const segImage = await imageLoader.createAndCacheDerivedLabelmapImage(currImgId)
          segmentation.addSegmentations([
            {
              segmentationId: segmentationId,
              representation: {
                type: SegmentationRepresentations.Labelmap,
                data: {
                  imageIds: [segImage.imageId],
                },
              },
            },
          ]);

          segmentation.triggerSegmentationEvents.triggerSegmentationDataModified(segmentationId);

          await segmentation.addLabelmapRepresentationToViewport(viewport.id, [
            {
              segmentationId: segmentationId,
            },
          ]);

          segmentationService.addSegment(segmentationId, {
            segmentIndex: 1,
            label: 'A',
            color: [76, 191, 0, 255], // green
            visibility: true,
            isLocked: true,
            active: true,
          });

          segmentationService.addSegment(segmentationId, {
            segmentIndex: 2,
            label: 'B',
            color: [250, 182, 25, 255], // orange
            visibility: true,
            isLocked: true,
            active: true,
          });

          segmentationService.addSegment(segmentationId, {
            segmentIndex: 3,
            label: 'C',
            color: [194, 29, 0, 255], // red
            visibility: true,
            isLocked: true,
            active: true,
          });

          segmentationService.addSegment(segmentationId, {
            segmentIndex: 4,
            label: 'undefined',
            color: [203, 230, 5, 255], // light green
            visibility: true,
            isLocked: true,
            active: false,
          });
        });
      },
    };

    const definitions = {
      computeTtpWr: {
        commandFn: actions.computeTtpWr,
        storeContexts: [],
        options: {},
      },
    };

    return {
      actions,
      definitions,
      defaultContext: 'DEFAULT',
    };
  },
  /**
   * ContextModule should provide a list of context that will be available in OHIF
   * and will be provided to the Modes. A context is a state that is shared OHIF.
   * Context is defined by an object of { name, context, provider }. Examples include
   * the measurementTracking context provided by the measurementTracking extension.
   */
  getContextModule: ({ servicesManager, commandsManager, extensionManager }) => {},
  /**
   * DataSourceModule should provide a list of data sources to be used in OHIF.
   * DataSources can be used to map the external data formats to the OHIF's
   * native format. DataSources are defined by an object of { name, type, createDataSource }.
   */
  getDataSourcesModule: ({ servicesManager, commandsManager, extensionManager }) => {},
};
