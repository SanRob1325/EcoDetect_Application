import React,{useState} from 'react';
import axios from 'axios';
import {Input,Button,Card,Spin,Typography} from 'antd'
import {LoadingOutlined} from '@ant-design/icons';
import './AIAssistant.css';

const {Title, Paragraph} = Typography

const AIAssistant = () => {
    const [userQuery,setUserQuery] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const[loading,setLoading] = useState(false)

    const handleQuerySubmit = async () => {
        if (!userQuery.trim()) return;

        setLoading(true);
        setAiResponse('');
        try{
            const response = await axios.post('http://localhost:50000/api/ai-assistant',{query: userQuery});
            setAiResponse(response.data.answer);
        }catch (error){
            console.error("Error fetching AI response",error);
            setAiResponse("Sorry errors producing the current request")
        }finally{
            setLoading(false);
        }
        }
        return (
            <div className='ai-page'>
                <Card title="Ask the AI about eco-friendly matierals,trends and your activity" className='ai-card'>
                    <Title level={3}>Ask a question:</Title>
                    <Input.TextArea
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    placeholder="Ask about ecofriendly tips and your activity..."
                    rows={4}
                    disable={loading} //Disable input when
                    />
                    <Button
                    type="primary"
                    onClick={handleQuerySubmit}
                    loading={loading}
                    style={{marginTop: '16px'}}
                    disabled={loading} 
                    >
                        Submit
                    </Button>
                    {loading && (
                        <Spin indicator={<LoadingOutlined style={{fontSize: 24}} spin />} style={{marginTop: '16px'}} />
                    )}
                    {aiResponse &&(
                        <div style={{marginTop: '20px'}}>
                            <Title level={4}>AI Response:</Title>
                            <Paragraph>{aiResponse}</Paragraph>
                        </div>
                    )}
                </Card>
            </div>
        )


    }
export default AIAssistant;