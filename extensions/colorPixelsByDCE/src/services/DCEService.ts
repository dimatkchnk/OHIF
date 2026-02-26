import { segmentation } from '@cornerstonejs/tools';
import { getEnabledElement } from '@cornerstonejs/core';
import { computeTtpWr } from '../utils/ttpWrMath';

let curve = [];
let overlay = null;

export function initDCEService(servicesManager, commandsManager) {
  // const { commandsManager } = servicesManager;

  commandsManager.registerCommand({
    name: 'computeTtpWr',
    commandFn: () => {
      const viewport =
        servicesManager.services.viewportGridService.getActiveViewport();
      const enabledElement = getEnabledElement(viewport.element);

      const imageIds = viewport.getImageIds();
      const segmentationId =
        segmentation.state.getSegmentations()[0]?.segmentationId;

      if (!segmentationId) {
        console.warn('Draw ROI first');
        return;
      }

      const result = computeTtpWr({
        imageIds,
        segmentationId,
        startFrame: 8,
      });

      curve = result.meanCurve;
      overlay = result.colorMap;

      viewport.render();
    },
  });

  servicesManager.registerService({
    name: 'ttpWrService',
    publicAPI: {
      getCurve: () => curve,
      getOverlay: () => overlay,
    },
  });
}