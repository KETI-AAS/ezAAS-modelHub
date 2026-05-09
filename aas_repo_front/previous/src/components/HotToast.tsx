// src/components/Toasts/ErrorToast.tsx

import { XCircleIcon } from "@heroicons/react/24/outline";
import { IconUxCircle } from "@tabler/icons-react";
import toast, { Toast } from "react-hot-toast";

interface ToastProps {
  t: Toast;
  message: string;
  messageType: "error";
}

export default function HotToast({ t, message, messageType }: ToastProps) {
  switch (messageType) {
    case "error":
      return (
        <div
          className={`${
            t.visible ? "animate-enter" : "animate-leave"
          } max-w-md w-full bg-red-50 border border-red-200 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
        >
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5 text-red-500">
                <IconUxCircle className="h-6 w-6" />
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-semibold text-red-800">Error</p>
                <p className="mt-1 text-sm text-red-600">{message}</p>
              </div>
            </div>
          </div>
          <div className="flex border-l border-red-200">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-red-600 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Close
            </button>
          </div>
        </div>
      );

    default:
      break;
  }
}
