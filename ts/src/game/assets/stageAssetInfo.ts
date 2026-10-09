

export const STAGE_DECK_MODELS: Readonly<Record<number, { readonly slab: string; readonly main: string; readonly alternate?: string }>> = {
  0: { slab: "war3mapImported\\StageDeck-7e2aae2330a24a8ac729f2e74e7461292e493daebf98cda5c5d99fc07e302052.mdx", main: "war3mapImported\\StageMainDeck-d84846d2cdced8d9736dca878d5d1fb303a50f512a0dea0eb06142af33fe1b06.mdx" },
  2: { slab: "war3mapImported\\StageDeck-490d920caa3293c2b59c64fd20600753fb50fb37792456ac09ca32120fcf9abc.mdx", main: "war3mapImported\\StageMainDeck-5ee5bfbdf7780ff3af5d5a6c8c5a04b1269bfa71600aaa2877b0130a1d59c7e9.mdx" },
  10: { slab: "war3mapImported\\StageDeck-5a3d1d08a39c69e330f63fa8f4f18afc731045bb4baede45cc8ce707fce1b2c7.mdx", main: "war3mapImported\\StageMainDeck-df69eebae5360948bb0bd0f7c6fc76e4cad7a27691248656efca1b82a606c71a.mdx" },
  11: { slab: "war3mapImported\\StageDeck-46d3e1533ec507ee9756d96b95b077596ac8ac527ade934265918bf3a35ff9ef.mdx", main: "war3mapImported\\StageMainDeck-fe065b7681d386e05382f03eafb53b9fd1ed525c1b32949b0699e8a49579161e.mdx", alternate: "war3mapImported\\StageDeck-6cf55f4c398fe902a2025f11b959e627452ccce8b3042ceac596a45f2077ccad.mdx" },
  3: { slab: "war3mapImported\\StageDeck-f50de2749e88b8f23c39e407d754a9ba2b5da1ce35cd1a3705e38f460ffcd4e2.mdx", main: "war3mapImported\\StageMainDeck-d515d10e84d10f2948cef82813083f8738ddebdcaadb52815b72e9d1f3f59db0.mdx" },
  4: { slab: "war3mapImported\\StageDeck-4508b3718f5c7777229ce5edd2ca3be08eb975ffee395f6d3b1d811060c662d0.mdx", main: "war3mapImported\\StageMainDeck-28c2bf5c3e5ec0ec7a949f50a708d31573fc52590e84fecba8b700b0661c45c3.mdx", alternate: "war3mapImported\\StageDeck-80aefce43aaad2415a8a3a59bcfef71488fb60af9d150612cb8a594ca7702d54.mdx" },
  14: { slab: "war3mapImported\\StageDeck-ac92d7d504dfa134c760f69c12b8c018b4d4699529fab3b0eceebcc44f578f6d.mdx", main: "war3mapImported\\StageMainDeck-a31fe67df8fe9fa25a5c12b6b16583753edca1216db7cfc662797515237e825b.mdx" },
  12: { slab: "war3mapImported\\StageDeck-14ac350c5ca9c3f1cdc914b44159f54889eaf7d0ac1be33eda7a1f6d2ef5a578.mdx", main: "war3mapImported\\StageMainDeck-1201cf5d5d0ff337e73be2bea46739833646cd706b8dc4229ecf330f5bdae0af.mdx" },
  6: { slab: "war3mapImported\\StageDeck-92dc55828d06da5ea6a9660d2457c9b6df2253be0cd2950a92de4dcf54d35b7e.mdx", main: "war3mapImported\\StageMainDeck-5dc41258c9e332f39a823514420054433f121f2b791a6f38b6a1b249d1b28f43.mdx" },
  7: { slab: "war3mapImported\\StageDeck-b0079668d2203d8a014ee33a6119ab6b5c70641d29f27d4d6da5ae0f3fab814c.mdx", main: "war3mapImported\\StageMainDeck-ac5fedf96938982359fe871a4e5113a78b8ebb12308a2e0252e0560a639002c8.mdx" },
  13: { slab: "war3mapImported\\StageDeck-8ad82e4800b62de2ef9da93ee09586c6cf9177cd41f234974006d6e7ba6780c0.mdx", main: "war3mapImported\\StageMainDeck-2c25bb13ee2212293baaae6e1f7a0c97bf6dcd2fb335453342c2ce192dbd2d2e.mdx" },
};

export const STAGE_DECK_MODEL = "war3mapImported\\StageDeck-7e2aae2330a24a8ac729f2e74e7461292e493daebf98cda5c5d99fc07e302052.mdx";

export const STAGE_MAIN_DECK_MODEL = "war3mapImported\\StageMainDeck-d84846d2cdced8d9736dca878d5d1fb303a50f512a0dea0eb06142af33fe1b06.mdx";

export const STAGE_SNOW_MODEL = "war3mapImported\\StageSnow-917b74168e66aca0467360dffd3956aabf3e0b69503b2f26da0ddedc1e8a5bd4.mdx";
/** Each stage's backdrop omni light models, in the order of its lights in stagePointLights.ts. */
export const STAGE_POINT_LIGHT_MODELS: Readonly<Record<number, readonly string[]>> = {
  4: ["war3mapImported\\StagePointLight-3c239f503cd4b885fb1d2ccbd395dce50e78f4797f65e6db0ea63e33a1d92923.mdx"],
  14: ["war3mapImported\\StagePointLight-a80bf58f5aab59d642ab911bc6ae05f69654de09308907c907d76de24c2fd479.mdx", "war3mapImported\\StagePointLight-e40b69be1b897ad6f33fb53f05e23630f4af667ba227af8a3da1b3ea270dfb6f.mdx"],
  12: ["war3mapImported\\StagePointLight-999e4101ca5c95726a64c7da6fb63358b7f581400b20ef4bc2c0aacdd79d4619.mdx", "war3mapImported\\StagePointLight-a570d9a1bc4c3789b5c18b15b77898cdc97168e585ea26494d42ebac45446328.mdx"],
  6: ["war3mapImported\\StagePointLight-999e4101ca5c95726a64c7da6fb63358b7f581400b20ef4bc2c0aacdd79d4619.mdx", "war3mapImported\\StagePointLight-a570d9a1bc4c3789b5c18b15b77898cdc97168e585ea26494d42ebac45446328.mdx"],
};
