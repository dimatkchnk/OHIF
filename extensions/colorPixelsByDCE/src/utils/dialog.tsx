import React from 'react';

export function showLoadingDialog(dialogService) {
  dialogService.show({
    id: 'dce-loading',
    title: 'DCE Analysis',
    shouldCloseOnEsc: false,
    shouldCloseOnOverlayClick: false,
    content: () => (
      <div className="flex flex-col items-center p-4 text-white">
        <div className="border-t-primary-main mb-3 h-8 w-8 animate-spin rounded-full border-4 border-gray-300" />
        <p>Computing TTP and WR, please wait...</p>
      </div>
    ),
  });
}

export function hideLoadingDialog(dialogService) {
  dialogService.hide({ id: 'dce-loading' });
}