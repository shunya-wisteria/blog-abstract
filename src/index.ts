export interface Env {
	LLM_API_ENDPOINT:string;
	LLM_API_KEY:string;

	BLOG_ABST_KV: KVNamespace;
}

export interface ReqBody {
	entryId: string;
	entryBody: string;
	useCache: boolean;
	saveCache: boolean;
}

export interface ResBody {
	status: string;
	code: string;
	abstract: string;
	useCache: boolean;
	saveCache: boolean;
}

export default {
	async fetch(request, env:Env, ctx): Promise<Response> {
		const PronptBase: string = "下記ブログの記事を200字以内に要約してしてください。<p>タグでくくったhtmlをテキスト形式で出力し、markdownのcode blockは使用しないでください。\n";

		// リクエストメソッドがPOSTでない場合はエラーを返す
		if (request.method !== 'POST') {
			const res: ResBody = {
				status: "E",
				code: "999",
				abstract: "",
				useCache: false,
				saveCache: false
			}

			return new Response(JSON.stringify(res), {
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
					"Content-Type": "application/json; charset=utf-8"
				}
			});
		}

		else {
			const reqBody: ReqBody = await request.json();

			// キャッシュを使用する場合
			if (reqBody.useCache) {
				// KVを検索
				const cachedAbstract: string | null = await env.BLOG_ABST_KV.get(reqBody.entryId);
				if (cachedAbstract !== null) {
					// キャッシュが存在する場合、キャッシュを使用してレスポンスを返す
					const res: ResBody = {
						status: "S",
						code: "000",
						abstract: cachedAbstract,
						useCache: true,
						saveCache: false
					}

					return new Response(JSON.stringify(res), {
						headers: {
							"Access-Control-Allow-Origin": "*",
							"Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
							"Content-Type": "application/json; charset=utf-8"
						}
					});
				}

			}

			// キャッシュを使用しない場合、Gemini APIを呼び出す
			const abstract: string = await CreateAbstract(reqBody, env);
			// APIエラーの場合終了
			if(abstract === "") {
				const res: ResBody = {
				status: "E",
				code: "900",
				abstract: "",
				useCache: false,
				saveCache: false
			}

			return new Response(JSON.stringify(res), {
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
					"Content-Type": "application/json; charset=utf-8"
				}
			});
			}

			// キャッシュに保存する場合
			if (reqBody.saveCache) {
				// KVに保存
				await env.BLOG_ABST_KV.put(reqBody.entryId, abstract);
			}

			const res: ResBody = {
				status: "S",
				code: "000",
				abstract: abstract,
				useCache: false,
				saveCache: reqBody.saveCache
			}

			return new Response(JSON.stringify(res), {
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
					"Content-Type": "application/json; charset=utf-8"
				}
			});
		}

		//-----------------------
		// 要約を作成する関数
		//
		// 引数：
		//	 reqBody: リクエストボディ
		//	 env: 環境変数
		// 戻り値：
		//	 要約文字列
		//-----------------------
		async function CreateAbstract(reqBody:ReqBody, env:Env):Promise<string>{
			// プロンプト作成
			const pronpt = PronptBase + reqBody.entryBody;
			// API呼び出しのための設定
			const apiReq = {
				contents: [{
					parts: [
						{
							text: pronpt
						}
					]
				}
				]
			};

			const apiInit = {
				body: JSON.stringify(apiReq),
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				}
			}

			const apiUrl = env.LLM_API_ENDPOINT + "?key=" + env.LLM_API_KEY;

			// APIを呼び出す
			const apiRes = await fetch(apiUrl, apiInit);

			// APIエラーの場合ブランクを返す
			if (apiRes.status !== 200) {
				return "";
			}
			
			const apiResBody:any = await apiRes.json();
			const abstract:string = apiResBody.candidates[0].content.parts[0].text;
			
			return abstract;
		}
	},
	
} satisfies ExportedHandler<Env>;
