/*
 * Second Memory — small shared mutable state object.
 * Kept deliberately dumb: view modules read/write it directly and call
 * each other's render functions explicitly. No reactivity framework.
 */
export const state = {
  theme: "dark",
  lang: "nl",

  filters: {
    search: "",
    tags: [],
    type: null,
  },

  list: {
    offset: 0,
    pageSize: 30,
    loading: false,
  },

  grid: {
    images: [],
    lightboxIndex: -1,
  },

  detailItemId: null,
  addType: "link",
  addImageFile: null,
  addFileFile: null,
};
